import assert from "node:assert/strict"
import { promises as fs } from "node:fs"
import test from "node:test"

import { requestInference } from "../src/inference-gateway.js"
import { getCvInferenceToken, getCvInferenceTransport } from "../src/runtime-config.js"

const imageDataUrl = "data:image/png;base64,YQ=="
const suggestion = { status: "pending_review", suggestedType: "crack", confidence: 0.61 }

test("Space requirements are self-contained with an explicit SDK-only Pydantic override", async () => {
  const base = await fs.readFile(new URL("../services/cv_inference/requirements.txt", import.meta.url), "utf8")
  const space = await fs.readFile(new URL("../deploy/huggingface/requirements.txt", import.meta.url), "utf8")
  assert.ok(!/^\s*(?:-r|--requirement|\.\/?|\/)/m.test(space))
  const requirements = (text) => text.split("\n").map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
  for (const dependency of requirements(base)) {
    const expected = dependency.startsWith("pydantic==") ? "pydantic==2.12.5" : dependency
    assert.ok(requirements(space).includes(expected), `Missing CV dependency: ${expected}`)
  }
})

function streamResponse(parts) {
  return new Response(new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(new TextEncoder().encode(part))
      controller.close()
    }
  }))
}

function request(fetchImpl, options = {}) {
  return requestInference(
    { endpointUrl: "https://cv.example", imageDataUrl, modelKey: "grounded-sam2" },
    { fetchImpl, transport: "gradio", timeoutMs: 1000, token: "", ...options }
  )
}

test("Gradio transport submits exactly one job and returns only its completed result", async () => {
  const calls = []
  const result = await request(async (url, options) => {
    calls.push({ url, options })
    return calls.length === 1
      ? Response.json({ event_id: "job_123" })
      : streamResponse([
        "event: heartbeat\r", "\ndata: null\r\n\r", "\n",
        "event: complete\r\ndata: " + JSON.stringify([{ suggestion }]) + "\r\n\r\n"
      ])
  }, { token: "test-only-placeholder" })
  assert.deepEqual(result, { suggestion })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, "https://cv.example/gradio_api/call/infer")
  assert.equal(calls[1].url, "https://cv.example/gradio_api/call/infer/job_123")
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    data: [{ imageDataUrl, modelKey: "grounded-sam2" }]
  })
  assert.equal(calls[0].options.signal, calls[1].options.signal)
  for (const call of calls) {
    assert.equal(call.options.redirect, "error")
    assert.equal(call.options.headers.authorization, "Bearer test-only-placeholder")
  }
})

test("Gradio transport never converts errors, incomplete jobs, or malformed results into success", async () => {
  for (const parts of [
    ["event: error\ndata: \"private upstream details\"\n\n"],
    ["event: heartbeat\ndata: null\n\n"],
    ["event: complete\ndata: invalid-json\n\n"],
    ["event: complete\ndata: []\n\n"],
    ["event: complete\ndata: [null]\n\n"]
  ]) {
    let calls = 0
    await assert.rejects(request(async () => ++calls === 1
      ? Response.json({ event_id: "job" }) : streamResponse(parts)), (error) => {
      assert.ok([502, 503].includes(error.statusCode))
      assert.ok(!error.message.includes("private upstream details"))
      return true
    })
    assert.equal(calls, 2)
  }
})

test("Gradio transport rejects invalid job identifiers without a second request", async () => {
  for (const eventId of ["../other", "https://evil.example", "", null]) {
    let calls = 0
    await assert.rejects(request(async () => {
      calls += 1
      return Response.json({ event_id: eventId })
    }), (error) => error.statusCode === 502)
    assert.equal(calls, 1)
  }
})

test("Gradio parser handles single-character chunks and split separators", async () => {
  let calls = 0
  const frame = "event: complete\r\ndata: " + JSON.stringify([{ suggestion }]) + "\r\n\r\n"
  const result = await request(async () => ++calls === 1
    ? Response.json({ event_id: "fragmented" })
    : streamResponse([...frame]))
  assert.deepEqual(result, { suggestion })
})

test("Gradio parser bounds cumulative response bytes", async () => {
  let calls = 0
  await assert.rejects(request(async () => ++calls === 1
    ? Response.json({ event_id: "oversized" })
    : streamResponse(["x".repeat(33 * 1024 * 1024)])),
  (error) => error.statusCode === 502)
})

test("Gradio quota rejection is explicit and is never automatically retried", async () => {
  let calls = 0
  await assert.rejects(request(async () => {
    calls += 1
    return new Response("quota exhausted", { status: 429 })
  }), (error) => error.statusCode === 429)
  assert.equal(calls, 1)
})

test("ZeroGPU quota errors inside an SSE job map to 429 without leaking provider details", async () => {
  let calls = 0
  await assert.rejects(request(async () => ++calls === 1
    ? Response.json({ event_id: "quota-job" })
    : streamResponse(["event: error\ndata: " + JSON.stringify({
      title: "ZeroGPU quota exceeded", error: "private-provider-message"
    }) + "\n\n"])), error => {
      assert.equal(error.statusCode, 429)
      assert.doesNotMatch(error.message, /private-provider-message/)
      return true
    })
  assert.equal(calls, 2)
})

test("Gradio uses the shared end-to-end deadline", async () => {
  let calls = 0
  await assert.rejects(request(async (_url, options) => {
    calls += 1
    if (calls === 1) return Response.json({ event_id: "job" })
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true })
    })
  }, { timeoutMs: 10 }), (error) => error.statusCode === 504)
  assert.equal(calls, 2)
})

test("REST remains the default and cloud credentials are opt-in", () => {
  const names = ["CV_INFERENCE_TRANSPORT", "CV_INFERENCE_TOKEN"]
  const previous = names.map((name) => process.env[name])
  try {
    for (const name of names) delete process.env[name]
    assert.equal(getCvInferenceTransport(), "rest")
    assert.equal(getCvInferenceToken(), "")
    process.env.CV_INFERENCE_TRANSPORT = "gradio"
    process.env.CV_INFERENCE_TOKEN = "test-only-placeholder"
    assert.equal(getCvInferenceTransport(), "gradio")
    assert.equal(getCvInferenceToken(), "test-only-placeholder")
  } finally {
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name]
      else process.env[name] = previous[index]
    })
  }
})
