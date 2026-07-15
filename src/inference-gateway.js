import { AppError } from "./app-error.js"
import {
  getCvInferenceMaxConcurrency,
  getCvInferenceMaxQueue,
  getCvInferenceTimeoutMs
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

export function getInferencePolicy() {
  return {
    timeoutMs: getCvInferenceTimeoutMs(),
    maxConcurrencyPerEndpoint: getCvInferenceMaxConcurrency(),
    maxQueuePerEndpoint: getCvInferenceMaxQueue()
  }
}

export async function requestInference(
  { endpointUrl, imageDataUrl, modelKey },
  { fetchImpl = globalThis.fetch, timeoutMs = getCvInferenceTimeoutMs() } = {}
) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  const executor = getEndpointExecutor(endpointUrl)

  let result
  try {
    result = await executor.run(
      async () => {
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
