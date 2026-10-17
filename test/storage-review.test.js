import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { promises as fs } from "node:fs"
import { createServer } from "node:http"
import os from "node:os"
import path from "node:path"
import test from "node:test"

const imageDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHj8uoAAAAASUVORK5CYII="
const suggestion = {
  source: "mock", modelKey: "deepcrack", modelLabel: "Mock test adapter",
  suggestedType: "crack", confidence: 0.44, status: "accepted"
}

async function startRuntime(backend, dataDir, inferenceUrl) {
  const child = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env, STORAGE_BACKEND: backend,
      DATABASE_URL: backend === "postgres" ? process.env.TEST_DATABASE_URL : "",
      POSTGRES_URL: "", BLOB_READ_WRITE_TOKEN: "",
      CONSTRUCTAI_DATA_DIR: dataDir, PORT: "0", HOST: "127.0.0.1",
      CV_INFERENCE_MODE: "external", CV_INFERENCE_URL: inferenceUrl,
      DEEPCRACK_INFERENCE_URL: "", DEMO_LIBRARY_WRITABLE: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  })
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Test server startup timed out")), 10_000)
    child.once("error", reject)
    child.once("exit", code => { clearTimeout(timer); reject(new Error(`Test server exited ${code}`)) })
    child.stdout.on("data", data => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/)
      if (match) { clearTimeout(timer); resolve(match[0]) }
    })
  })
  return { child, base }
}

for (const backend of ["local", "postgres"]) {
  test(`${backend}: API review/persistence/report/reanalysis parity`, {
    skip: backend === "postgres" && !process.env.TEST_DATABASE_URL
      ? "Optional isolated Postgres requires TEST_DATABASE_URL on localhost with a constructai_test_ database."
      : false
  }, async (t) => {
    if (backend === "postgres") {
      const url = new URL(process.env.TEST_DATABASE_URL)
      assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Only local test Postgres is permitted")
      assert.match(url.pathname, /^\/constructai_test_[a-z0-9_]+$/i)
    }
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "constructai-review-test-"))
    let unavailable = false
    let holdInference = null
    let inferenceEntered = null
    const inference = createServer(async (req, res) => {
      for await (const chunk of req) { void chunk }
      inferenceEntered?.()
      if (holdInference) await holdInference
      res.writeHead(unavailable ? 503 : 200, { "content-type": "application/json" })
      res.end(JSON.stringify(unavailable ? { error: "Test inference unavailable" } : { suggestion }))
    })
    inference.listen(0, "127.0.0.1")
    await once(inference, "listening")
    const { child, base } = await startRuntime(backend, dataDir, `http://127.0.0.1:${inference.address().port}`)
    t.after(async () => {
      const exited = once(child, "exit")
      child.kill("SIGTERM")
      await exited
      await new Promise(resolve => inference.close(resolve))
      await fs.rm(dataDir, { recursive: true, force: true })
    })
    async function api(route, body, method = body ? "POST" : "GET", expected = body ? 201 : 200) {
      const res = await fetch(base + route, {
        method, headers: { "content-type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {})
      })
      const result = await res.json()
      assert.equal(res.status, expected, JSON.stringify(result))
      return result
    }
    const { project } = await api("/api/projects", { name: `Fictional ${backend} test project` })
    const { session } = await api("/api/sessions", { projectId: project.id, inspectorName: "Demo operator" })
    const input = { sessionId: session.id, imageDataUrl, defectType: "crack", comment: "Fictional demo observation.", aiSuggestion: suggestion }
    const { defect: manual } = await api("/api/defects", { ...input, aiDecision: "manual" })
    assert.equal(manual.aiSuggestion.review.decision, "manual")
    assert.equal(manual.aiSuggestion.typeMatchesSuggestion, true)
    const { defect: accepted } = await api("/api/defects", { ...input, aiDecision: "accepted" })
    assert.equal(accepted.aiSuggestion.review.decision, "accepted")
    const edit = { defectType: "spalling", comment: input.comment }
    const { defect: corrected } = await api(`/api/defects/${accepted.id}`, edit, "PATCH", 200)
    assert.equal(corrected.aiSuggestion.review.decision, "corrected")
    assert.equal(corrected.aiSuggestion.finalType, "spalling")
    const { defect: pending } = await api("/api/defects", input)
    assert.equal(pending.aiSuggestion.review.decision, "pending_review")

    unavailable = true
    await api("/api/ai/suggest", { imageDataUrl, modelKey: "deepcrack" }, "POST", 503)
    const { defect: noAi } = await api("/api/defects", { ...input, aiSuggestion: null })
    assert.equal(noAi.aiSuggestion, null)
    unavailable = false

    const bundle = await api(`/api/sessions/${session.id}`)
    assert.equal(bundle.defects.find(d => d.id === manual.id).aiSuggestion.review.decision, "manual")
    assert.equal(bundle.defects.find(d => d.id === corrected.id).defectType, "spalling")
    const { report } = await api("/api/reports", { sessionId: session.id, reportLocale: "en" })
    assert.equal(report.snapshot.defects.find(d => d.id === manual.id).aiSuggestion.review.decision, "manual")
    const documentUrl = base + report.generatedDocument.publicPath
    const html = await (await fetch(documentUrl)).text()
    assert.match(html, /Manual selection/)
    assert.match(html, /AI corrected/)
    assert.match(html, /AI suggestion pending/)
    assert.match(html, /Manual entry/)
    assert.doesNotMatch(html, /AI accepted|Трещина/)

    const { defect: reanalysed } = await api(`/api/defects/${manual.id}/reanalyse`, { modelKey: "deepcrack" }, "POST", 200)
    assert.equal(reanalysed.aiSuggestion.review.decision, "pending_review")
    assert.notEqual(reanalysed.aiSuggestion.suggestionId, manual.aiSuggestion.suggestionId)
    await api(`/api/defects/${manual.id}`, {
      defectType: "crack", comment: input.comment, aiDecision: "accepted",
      reviewSuggestionId: manual.aiSuggestion.suggestionId
    }, "PATCH", 409)
    const { defect: reviewed } = await api(`/api/defects/${manual.id}`, {
      defectType: "crack", comment: input.comment, aiDecision: "accepted",
      reviewSuggestionId: reanalysed.aiSuggestion.suggestionId
    }, "PATCH", 200)
    assert.equal(reviewed.aiSuggestion.review.decision, "accepted")
    assert.equal(await (await fetch(documentUrl)).text(), html, "Historical report bytes must not change")
    assert.equal((await fetch(base + manual.photos[0].publicPath)).status, 200)

    if (backend === "postgres") {
      let release
      holdInference = new Promise(resolve => { release = resolve })
      const entered = new Promise(resolve => { inferenceEntered = resolve })
      const runningAnalysis = api(`/api/defects/${manual.id}/reanalyse`, { modelKey: "deepcrack" }, "POST", 409)
      await entered
      try {
        await api(`/api/defects/${manual.id}`, { defectType: "spalling", comment: "Edited while inference was running." }, "PATCH", 200)
      } finally {
        release()
      }
      await runningAnalysis
      const afterRace = await api(`/api/sessions/${session.id}`)
      const racedDefect = afterRace.defects.find(d => d.id === manual.id)
      assert.equal(racedDefect.defectType, "spalling")
      assert.equal(racedDefect.aiSuggestion.review.decision, "corrected")
    }
  })
}
