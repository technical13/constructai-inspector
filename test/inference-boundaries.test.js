import assert from "node:assert/strict"
import { promises as fs } from "node:fs"
import test from "node:test"

import {
  BoundedExecutor,
  InferenceQueueFullError,
  requestInference
} from "../src/inference-gateway.js"
import { validateCvBenchmarkManifest } from "../src/cv-benchmark.js"
import {
  getCvInferenceMaxConcurrency,
  getCvInferenceMaxQueue,
  getCvInferenceTimeoutMs
} from "../src/runtime-config.js"

function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function nextTurn() {
  return new Promise((resolve) => setImmediate(resolve))
}

test("bounded executor serializes work and preserves FIFO order", async () => {
  const executor = new BoundedExecutor({ maxConcurrency: 1, maxQueue: 2 })
  const firstGate = deferred()
  const order = []

  const first = executor.run(async () => {
    order.push("first:start")
    await firstGate.promise
    order.push("first:end")
  })
  const second = executor.run(async () => {
    order.push("second")
  })

  await nextTurn()
  assert.deepEqual(executor.stats, {
    active: 1,
    queued: 1,
    maxConcurrency: 1,
    maxQueue: 2
  })
  firstGate.resolve()
  await Promise.all([first, second])
  assert.deepEqual(order, ["first:start", "first:end", "second"])
})

test("bounded executor rejects work beyond queue capacity", async () => {
  const executor = new BoundedExecutor({ maxConcurrency: 1, maxQueue: 1 })
  const gate = deferred()
  const active = executor.run(() => gate.promise)
  const queued = executor.run(() => undefined)

  await assert.rejects(
    executor.run(() => undefined),
    (error) => error instanceof InferenceQueueFullError
  )
  gate.resolve()
  await Promise.all([active, queued])
})

test("inference gateway applies an end-to-end timeout", async () => {
  const fetchImpl = (_url, options) =>
    new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(options.signal.reason), {
        once: true
      })
    })

  await assert.rejects(
    requestInference(
      {
        endpointUrl: "http://timeout.invalid",
        imageDataUrl: "data:image/png;base64,AA==",
        modelKey: "deepcrack"
      },
      { fetchImpl, timeoutMs: 10 }
    ),
    (error) => error.statusCode === 504
  )
})

test("CV benchmark references are valid and cannot support accuracy claims", async () => {
  const manifest = JSON.parse(
    await fs.readFile(new URL("../benchmarks/cv/manifest.json", import.meta.url), "utf8")
  )
  const scenarios = JSON.parse(
    await fs.readFile(new URL("../public/demo/scenarios.json", import.meta.url), "utf8")
  )

  assert.deepEqual(validateCvBenchmarkManifest(manifest, scenarios), [])
  assert.equal(manifest.referencePolicy.kind, "curated-model-output")
  assert.equal(manifest.referencePolicy.accuracyClaimAllowed, false)
})

test("bounded inference defaults are preserved when env variables are absent", () => {
  const names = [
    "CV_INFERENCE_TIMEOUT_MS",
    "CV_INFERENCE_MAX_CONCURRENCY",
    "CV_INFERENCE_MAX_QUEUE"
  ]
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]))
  for (const name of names) {
    delete process.env[name]
  }

  try {
    assert.equal(getCvInferenceTimeoutMs(), 120_000)
    assert.equal(getCvInferenceMaxConcurrency(), 1)
    assert.equal(getCvInferenceMaxQueue(), 8)
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) {
        delete process.env[name]
      } else {
        process.env[name] = previous[name]
      }
    }
  }
})
