import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { Readable } from "node:stream"
import { promises as fs } from "node:fs"
import test from "node:test"
import { AppError } from "../src/app-error.js"
import { handleApiRequest } from "../src/api-handler.js"
import {
  createPreviewHandler, getPreviewConfig, normalizePreviewResult,
  PreviewRateLimiter, previewEndpoint, validatePreviewPayload, PREVIEW_MAX_BODY_BYTES
} from "../src/public-preview.js"
import { isPublicPreview } from "../src/runtime-config.js"
import { demoPreview, describePreviewResult, previewCopy, PreviewRun } from "../public/preview-contract.js"

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64")
const dataUrl = `data:image/png;base64,${png.toString("base64")}`
const inputSha256 = createHash("sha256").update(png).digest("hex")
const settings = {
  CV_INFERENCE_MODE: "external", CV_INFERENCE_TRANSPORT: "gradio",
  GROUNDED_SAM2_INFERENCE_URL: "https://test-space.hf.space", VERCEL: "", PUBLIC_PREVIEW_MODE: "true"
}

async function withEnv(env, action) {
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]))
  try {
    for (const [key, value] of Object.entries(env)) process.env[key] = value
    return await action()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

function cloudResult(overrides = {}) {
  return { suggestion: {
    analysisMode: "live", status: "pending_review", modelKey: "grounded-sam2",
    suggestedType: "crack", confidence: .42,
    visualEvidence: { maskDataUrl: dataUrl, maskWidth: 1, maskHeight: 1 },
    inferenceProvenance: { host: "huggingface-zerogpu", inputSha256, inferenceSize: { width: 1, height: 1 } },
    ...overrides
  } }
}

async function call(handler, { method = "POST", path = "/api/preview/analyze", body = { imageDataUrl: dataUrl, consent: true }, headers = {}, raw } = {}) {
  const request = Readable.from([raw || Buffer.from(JSON.stringify(body))])
  request.method = method
  request.headers = { host: "preview.test", "content-type": "application/json", ...headers }
  request.socket = { remoteAddress: "127.0.0.1" }
  let status, responseHeaders, payload
  const response = {
    writeHead(code, values) { status = code; responseHeaders = values },
    end(text) { payload = JSON.parse(text) }
  }
  await handler(request, response, path)
  return { status, headers: responseHeaders, body: payload }
}

test("public preview is mandatory on Vercel and opt-in locally", async () => {
  await withEnv({ VERCEL: "1", PUBLIC_PREVIEW_MODE: "false" }, () => assert.equal(isPublicPreview(), true))
  await withEnv({ VERCEL: "", PUBLIC_PREVIEW_MODE: "false" }, () => assert.equal(isPublicPreview(), false))
  await withEnv({ VERCEL: "", PUBLIC_PREVIEW_MODE: "true" }, () => assert.equal(isPublicPreview(), true))
})

test("public API denies every workspace read/write route before storage", async () => {
  await withEnv({ VERCEL: "1" }, async () => {
    for (const [method, path] of [
      ["GET", "/api/bootstrap"], ["POST", "/api/projects"], ["POST", "/api/sessions"],
      ["GET", "/api/sessions/test"], ["POST", "/api/defects"], ["PATCH", "/api/defects/test"],
      ["DELETE", "/api/defects/test"], ["POST", "/api/defects/test/reanalyse"],
      ["POST", "/api/reports"], ["GET", "/api/reports/test/document"], ["GET", "/api/media/test"],
      ["POST", "/api/ai/suggest"], ["POST", "/api/ai/compare"], ["POST", "/api/demo-scenarios"],
      ["DELETE", "/api/demo-scenarios/test"]
    ]) {
      const result = await call(handleApiRequest, { method, path })
      assert.equal(result.status, 403, `${method} ${path}`)
      assert.equal(result.body.code, "WORKSPACE_PRIVATE")
    }
  })
})

test("only configured HTTPS Hugging Face endpoints enable live public inference", async () => {
  await withEnv(settings, async () => {
    assert.equal(previewEndpoint(), "https://test-space.hf.space")
    for (const url of ["http://test.hf.space", "https://elsewhere.test", "https://a.hf.space/extra", "https://x@y.hf.space", "https://a.hf.space?token=private"]) {
      await withEnv({ GROUNDED_SAM2_INFERENCE_URL: url }, () => assert.equal(previewEndpoint(), ""))
    }
    await withEnv({ CV_INFERENCE_MODE: "mock" }, () => assert.equal(previewEndpoint(), ""))
    await withEnv({ CV_INFERENCE_TRANSPORT: "rest" }, () => assert.equal(previewEndpoint(), ""))
  })
})

test("public config is read-only and never contains the server token or database fields", async () => {
  await withEnv({ ...settings, CV_INFERENCE_TOKEN: "test-token-not-a-real-secret" }, async () => {
    const result = await call(createPreviewHandler(), { method: "GET", path: "/api/preview/config" })
    assert.equal(result.status, 200)
    assert.equal(result.body.storage, "none")
    assert.equal(result.body.liveConfigured, true)
    assert.equal(result.headers["cache-control"], "no-store")
    assert.doesNotMatch(JSON.stringify(result.body), /test-token|DATABASE|projects|sessions|hf\.space/)
    assert.deepEqual(result.body, getPreviewConfig())
  })
})

test("image contract requires consent, a real raster signature and strict bounded base64", () => {
  assert.equal(validatePreviewPayload({ imageDataUrl: dataUrl, consent: true }).sha256, inputSha256)
  for (const body of [null, [], {}, { imageDataUrl: dataUrl, consent: false },
    { imageDataUrl: dataUrl, consent: true, modelKey: "other" },
    { imageDataUrl: dataUrl.replace("image/png", "image/jpeg"), consent: true },
    { imageDataUrl: "data:image/svg+xml;base64,PHN2Zy8+", consent: true },
    { imageDataUrl: "data:image/png;base64,AA==\n", consent: true },
    { imageDataUrl: "x".repeat(PREVIEW_MAX_BODY_BYTES + 1), consent: true }]) {
    assert.throws(() => validatePreviewPayload(body), error => error instanceof AppError)
  }
})

test("preview result rejects wrong provenance, implicit acceptance, mismatched masks and mock outputs", () => {
  const result = normalizePreviewResult(cloudResult(), inputSha256)
  assert.equal(result.status, "pending_review")
  assert.equal(result.confidence, .42)
  assert.equal(result.visualEvidence.maskWidth, 1)
  for (const overrides of [{ analysisMode: "mock" }, { status: "accepted" }, { modelKey: "deepcrack" },
    { inferenceProvenance: { host: "local" } }, { visualEvidence: { maskDataUrl: dataUrl, maskWidth: 2, maskHeight: 1 } }]) {
    assert.throws(() => normalizePreviewResult(cloudResult(overrides), inputSha256), error => error.statusCode === 502)
  }
  assert.throws(() => normalizePreviewResult(cloudResult(), "wrong-image"), error => error.statusCode === 502)
  assert.equal(normalizePreviewResult(cloudResult({ suggestedType: "other", visualEvidence: null }), inputSha256).visualEvidence, null)
})

test("public API submits one real-model job, drops provider text, and does not auto-accept", async () => {
  await withEnv(settings, async () => {
    let calls = 0
    const handler = createPreviewHandler({ infer: async (input, options) => {
      calls++
      assert.equal(input.modelKey, "grounded-sam2")
      assert.equal(options.transport, "gradio")
      assert.equal(options.timeoutMs, 165_000)
      return cloudResult({ rationale: "private provider content", secret: "not public" })
    } })
    const result = await call(handler, { headers: { origin: "https://preview.test" } })
    assert.equal(calls, 1)
    assert.equal(result.status, 200)
    assert.equal(result.body.humanConfirmationRequired, true)
    assert.doesNotMatch(JSON.stringify(result.body), /private provider|not public/)
  })
})

test("public API rejects cross-site, malformed, oversize and unconsented uploads before inference", async () => {
  await withEnv(settings, async () => {
    let calls = 0
    const infer = async () => { calls++; return cloudResult() }
    for (const options of [
      { headers: { origin: "https://other.test" } }, { headers: { origin: "null" } },
      { headers: { "sec-fetch-site": "cross-site" } }, { headers: { "content-type": "text/plain" } },
      { raw: Buffer.from("not json") }, { raw: Buffer.alloc(PREVIEW_MAX_BODY_BYTES + 1) },
      { body: { imageDataUrl: dataUrl, consent: false } }
    ]) {
      const result = await call(createPreviewHandler({ infer }), options)
      assert.ok(result.status >= 400)
    }
    assert.equal(calls, 0)
  })
})

test("per-process burst limits are finite and reset without storing IP addresses", () => {
  const limiter = new PreviewRateLimiter()
  limiter.take("a", 100_000)
  limiter.take("a", 100_001)
  assert.throws(() => limiter.take("a", 100_002), error => error.statusCode === 429 && error.retryAfter === 60)
  limiter.take("b", 100_003)
  limiter.take("b", 100_004)
  assert.throws(() => limiter.take("c", 100_005), error => error.statusCode === 429)
  limiter.take("a", 160_000)
})

test("parallel public jobs have no local queue and quota failures never become demo success", async () => {
  await withEnv(settings, async () => {
    let finish
    const gate = new Promise(resolve => { finish = resolve })
    const handler = createPreviewHandler({ infer: async () => { await gate; return cloudResult() } })
    const first = call(handler)
    await new Promise(resolve => setImmediate(resolve))
    const second = await call(handler)
    assert.equal(second.status, 429)
    assert.equal(second.body.code, "SERVICE_BUSY")
    finish()
    assert.equal((await first).status, 200)
    let calls = 0
    const quota = createPreviewHandler({ infer: async () => { calls++; throw new AppError(429, "provider-private-detail") } })
    const result = await call(quota)
    assert.equal(result.status, 429)
    assert.equal(result.body.code, "GPU_QUOTA_EXCEEDED")
    assert.equal(result.body.suggestion, undefined)
    assert.doesNotMatch(JSON.stringify(result.body), /provider-private-detail/)
    assert.equal(calls, 1)
  })
})

test("both locales preserve raw scores, provisional labels and honest demo provenance", () => {
  const demo = demoPreview({ suggestion: { confidence: .42, status: "accepted", suggestedType: "crack" } })
  assert.equal(demo.status, "pending_review")
  assert.equal(demo.analysisMode, "precomputed_demo")
  assert.equal(describePreviewResult(demo, "en").score, "0.420")
  assert.match(describePreviewResult(demo, "en").provenance, /Precomputed demo/)
  assert.match(describePreviewResult({ confidence: .27, suggestedType: "corrosion" }, "en").title, /corrosion/)
  assert.deepEqual(Object.keys(previewCopy("en")).sort(), Object.keys(previewCopy("ru")).sort())
  for (const text of Object.values(previewCopy("en"))) assert.doesNotMatch(text, /[А-Яа-яЁё]/)
})

test("changing the photo or mode invalidates stale live results", () => {
  const run = new PreviewRun()
  const old = run.invalidate()
  assert.equal(run.isCurrent(old), true)
  const current = run.invalidate()
  assert.equal(run.isCurrent(old), false)
  assert.equal(run.isCurrent(current), true)
})

test("public browser entry never calls workspace APIs, inserts HTML, or sends an image automatically", async () => {
  const source = await fs.readFile(new URL("../public/preview.js", import.meta.url), "utf8")
  assert.doesNotMatch(source, /innerHTML|\/api\/(bootstrap|projects|sessions|defects|reports|ai)/)
  assert.equal([...source.matchAll(/fetch\("\/api\/preview\/analyze"/g)].length, 1)
  const html = await fs.readFile(new URL("../public/try.html", import.meta.url), "utf8")
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length)
  for (const [, id] of source.matchAll(/\$\("([^"]+)"\)/g)) assert.ok(ids.includes(id), `Missing ${id}`)
})

test("Vercel root redirects before the legacy static index can be served", async () => {
  const config = JSON.parse(await fs.readFile(new URL("../vercel.json", import.meta.url), "utf8"))
  assert.ok(config.redirects.some(rule => rule.source === "/" && rule.destination === "/try" && rule.permanent === false))
  assert.ok(config.redirects.some(rule => rule.source === "/index.html" && rule.destination === "/try"))
  assert.ok(config.rewrites.some(rule => rule.source === "/try" && rule.destination === "/try.html"))
})
