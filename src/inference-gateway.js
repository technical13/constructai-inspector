import { AppError } from "./app-error.js"
import {
  getCvInferenceMaxConcurrency,
  getCvInferenceMaxQueue,
  getCvInferenceTimeoutMs,
  getCvInferenceTransport,
  getCvInferenceToken
} from "./runtime-config.js"

export class InferenceQueueFullError extends Error {
  constructor(message = "Inference queue is full.") {
    super(message)
    this.name = "InferenceQueueFullError"
  }
}

export class BoundedExecutor {
  #active = 0
  #maxConcurrency
  #maxQueue
  #queue = []

  constructor({ maxConcurrency = 1, maxQueue = 8 } = {}) {
    if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
      throw new TypeError("maxConcurrency must be a positive integer")
    }
    if (!Number.isInteger(maxQueue) || maxQueue < 0) {
      throw new TypeError("maxQueue must be a non-negative integer")
    }

    this.#maxConcurrency = maxConcurrency
    this.#maxQueue = maxQueue
  }

  get stats() {
    return {
      active: this.#active,
      queued: this.#queue.length,
      maxConcurrency: this.#maxConcurrency,
      maxQueue: this.#maxQueue
    }
  }

  run(task, { signal } = {}) {
    if (typeof task !== "function") {
      return Promise.reject(new TypeError("task must be a function"))
    }
    if (signal?.aborted) {
      return Promise.reject(signal.reason || new Error("Inference request aborted."))
    }

    return new Promise((resolve, reject) => {
      const entry = {
        task,
        resolve,
        reject,
        signal,
        started: false,
        abortHandler: null
      }

      if (signal) {
        entry.abortHandler = () => {
          if (entry.started) {
            return
          }

          const index = this.#queue.indexOf(entry)
          if (index >= 0) {
            this.#queue.splice(index, 1)
          }
          reject(signal.reason || new Error("Inference request aborted."))
        }
        signal.addEventListener("abort", entry.abortHandler, { once: true })
      }

      if (this.#active < this.#maxConcurrency) {
        this.#start(entry)
        return
      }

      if (this.#queue.length >= this.#maxQueue) {
        this.#removeAbortListener(entry)
        reject(new InferenceQueueFullError())
        return
      }

      this.#queue.push(entry)
    })
  }

  #removeAbortListener(entry) {
    if (entry.signal && entry.abortHandler) {
      entry.signal.removeEventListener("abort", entry.abortHandler)
    }
  }

  #start(entry) {
    entry.started = true
    this.#active += 1

    Promise.resolve()
      .then(entry.task)
      .then(entry.resolve, entry.reject)
      .finally(() => {
        this.#removeAbortListener(entry)
        this.#active -= 1
        this.#drain()
      })
  }

  #drain() {
    while (this.#active < this.#maxConcurrency && this.#queue.length > 0) {
      const entry = this.#queue.shift()
      if (!entry.signal?.aborted) {
        this.#start(entry)
      }
    }
  }
}

const endpointExecutors = new Map()

function getEndpointExecutor(endpointUrl) {
  const maxConcurrency = getCvInferenceMaxConcurrency()
  const maxQueue = getCvInferenceMaxQueue()
  const key = `${endpointUrl}|${maxConcurrency}|${maxQueue}`

  if (!endpointExecutors.has(key)) {
    endpointExecutors.set(
      key,
      new BoundedExecutor({ maxConcurrency, maxQueue })
    )
  }

  return endpointExecutors.get(key)
}

function parseResponsePayload(text) {
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new AppError(502, "CV inference service вернул невалидный JSON.")
  }
}

function getResponseError(payload, statusCode) {
  return (
    payload?.detail ||
    payload?.error ||
    `CV inference service вернул ошибку ${statusCode}.`
  )
}

const MAX_GRADIO_RESPONSE_BYTES = 32 * 1024 * 1024

async function readGradioResult(response) {
  if (!response.body) throw new AppError(502, "Gradio returned an empty event stream.")
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let tail = ""
  let frameParts = []
  let bytes = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > MAX_GRADIO_RESPONSE_BYTES) {
        throw new AppError(502, "Gradio response exceeded the size limit.")
      }
      // Keep only the possible separator suffix; do not rescan a growing mask.
      const text = tail + decoder.decode(value, { stream: true })
      let start = 0
      for (const boundary of text.matchAll(/\r?\n\r?\n/g)) {
        frameParts.push(text.slice(start, boundary.index))
        const frame = frameParts.join("")
        frameParts = []
        start = boundary.index + boundary[0].length
        const lines = frame.split(/\r?\n/)
        const event = lines.find((line) => line.startsWith("event:"))?.slice(6).trim()
        if (event === "error") {
          const data = lines.filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trimStart()).join("\n")
          try {
            if (JSON.parse(data)?.title === "ZeroGPU quota exceeded") {
              throw new AppError(429, "The shared GPU allowance is currently exhausted.")
            }
          } catch (error) {
            if (error instanceof AppError) throw error
          }
          throw new AppError(503, "Cloud inference failed or the GPU quota is unavailable.")
        }
        if (event !== "complete") continue
        const data = lines.filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n")
        const output = parseResponsePayload(data)
        if (!Array.isArray(output) || output.length !== 1 ||
            !output[0] || typeof output[0] !== "object" || Array.isArray(output[0])) {
          throw new AppError(502, "Gradio returned an invalid inference result.")
        }
        return output[0]
      }
      const remainder = text.slice(start)
      const safeLength = Math.max(0, remainder.length - 3)
      if (safeLength > 0) frameParts.push(remainder.slice(0, safeLength))
      tail = remainder.slice(safeLength)
      if (frameParts.length > 100_000) {
        throw new AppError(502, "Gradio response was excessively fragmented.")
      }
    }
    throw new AppError(502, "Gradio ended without a completed inference result.")
  } finally {
    await reader.cancel().catch(() => {})
  }
}

async function requestGradio({ endpointUrl, imageDataUrl, modelKey, fetchImpl, signal, token }) {
  const headers = {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {})
  }
  const base = `${endpointUrl.replace(/\/$/, "")}/gradio_api/call/infer`
  const submitted = await fetchImpl(base, {
    method: "POST", headers, redirect: "error", signal,
    body: JSON.stringify({ data: [{ imageDataUrl, modelKey }] })
  })
  if (!submitted.ok) {
    throw new AppError(submitted.status, "Cloud inference submission was rejected.")
  }
  const job = parseResponsePayload(await submitted.text())
  if (!job || typeof job.event_id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(job.event_id)) {
    throw new AppError(502, "Gradio returned an invalid job identifier.")
  }
  const response = await fetchImpl(`${base}/${job.event_id}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    redirect: "error", signal
  })
  if (!response.ok) {
    throw new AppError(response.status, "Cloud inference result was unavailable.")
  }
  return readGradioResult(response)
}

export function getInferencePolicy() {
  return {
    timeoutMs: getCvInferenceTimeoutMs(),
    maxConcurrencyPerEndpoint: getCvInferenceMaxConcurrency(),
    maxQueuePerEndpoint: getCvInferenceMaxQueue()
  }
}

export async function requestInference(
  { endpointUrl, imageDataUrl, modelKey },
  {
    fetchImpl = globalThis.fetch,
    timeoutMs = getCvInferenceTimeoutMs(),
    transport = getCvInferenceTransport(),
    token = getCvInferenceToken()
  } = {}
) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const executor = getEndpointExecutor(endpointUrl)

  let result
  try {
    result = await executor.run(
      async () => {
        if (transport === "gradio") {
          const payload = await requestGradio({
            endpointUrl, imageDataUrl, modelKey, fetchImpl, signal: timeoutSignal, token
          })
          return { ok: true, status: 200, text: JSON.stringify(payload) }
        }
        const response = await fetchImpl(`${endpointUrl}/infer`, {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({ imageDataUrl, modelKey }),
          signal: timeoutSignal
        })
        return {
          ok: response.ok,
          status: response.status,
          text: await response.text()
        }
      },
      { signal: timeoutSignal }
    )
  } catch (error) {
    if (error instanceof InferenceQueueFullError) {
      throw new AppError(
        429,
        "Очередь CV inference заполнена. Дождитесь завершения текущего анализа."
      )
    }
    if (timeoutSignal.aborted) {
      throw new AppError(
        504,
        `CV inference превысил лимит ${timeoutMs} мс.`
      )
    }
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(503, "CV inference service недоступен.")
  }

  const payload = parseResponsePayload(result.text)
  if (!result.ok) {
    throw new AppError(result.status, getResponseError(payload, result.status))
  }

  return payload
}
