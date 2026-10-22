import { createHash, randomBytes } from "node:crypto"
import { isIP } from "node:net"
import { AppError } from "./app-error.js"
import { requestInference, BoundedExecutor, InferenceQueueFullError } from "./inference-gateway.js"
import { getCvInferenceMode, getCvInferenceTransport, getCvModelUrl } from "./runtime-config.js"
import { defectCatalog } from "./catalog.js"
import modelLock from "../services/cv_inference/sam3-model.json" with { type: "json" }

export const PREVIEW_MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const PREVIEW_MAX_BODY_BYTES = 3 * 1024 * 1024
const MAX_MASK_BYTES = 2 * 1024 * 1024
const MAX_RESPONSE_BYTES = 3 * 1024 * 1024
const knownTypes = new Set(defectCatalog.map(item => item.id))

function problem(statusCode, code, message, retryAfter = null) {
  return Object.assign(new AppError(statusCode, message), { code, retryAfter })
}

// A bounded, per-process burst guard, not a distributed quota. HF enforces the
// account-wide GPU allowance. No IP address or image is persisted here.
export class PreviewRateLimiter {
  #entries = new Map()
  #windowStart = 0
  #total = 0
  #salt = randomBytes(16)

  take(client, now = Date.now()) {
    const windowMs = 60_000
    if (now - this.#windowStart >= windowMs || now < this.#windowStart) {
      this.#windowStart = now
      this.#total = 0
      this.#entries.clear()
    }
    const retryAfter = Math.max(1, Math.ceil((this.#windowStart + windowMs - now) / 1000))
    const key = createHash("sha256").update(this.#salt).update(client).digest("hex")
    const count = this.#entries.get(key) || 0
    if (this.#total >= 4 || count >= 2 || (!this.#entries.has(key) && this.#entries.size >= 1024)) {
      throw problem(429, "RATE_LIMITED", "Please wait before another analysis.", retryAfter)
    }
    this.#entries.set(key, count + 1)
    this.#total += 1
  }
}

export function previewEndpoint() {
  if (getCvInferenceMode() !== "external" || getCvInferenceTransport() !== "gradio") return ""
  try {
    const url = new URL(getCvModelUrl("sam3"))
    if (url.protocol !== "https:" || !url.hostname.endsWith(".hf.space") ||
        url.username || url.password || url.port || url.search || url.hash || url.pathname !== "/") return ""
    return url.origin
  } catch {
    return ""
  }
}

export function getPreviewConfig() {
  return {
    mode: "public_preview",
    liveConfigured: previewEndpoint() !== "",
    modelLabel: "SAM 3",
    maxImageBytes: PREVIEW_MAX_IMAGE_BYTES,
    maxImageSide: 1600,
    storage: "none",
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.APP_SOURCE_COMMIT || null
  }
}

export function validatePreviewPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some(key => !["imageDataUrl", "consent"].includes(key))) {
    throw problem(400, "INVALID_IMAGE", "Invalid analysis request.")
  }
  if (body.consent !== true) {
    throw problem(400, "CONSENT_REQUIRED", "Confirm that the photo may be processed by Hugging Face.")
  }
  if (typeof body.imageDataUrl !== "string" || body.imageDataUrl.length > PREVIEW_MAX_BODY_BYTES) {
    throw problem(413, "IMAGE_TOO_LARGE", "The resized image must be at most 2 MiB.")
  }
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.imageDataUrl)
  if (!match || match[2].length % 4 !== 0) {
    throw problem(415, "INVALID_IMAGE", "Use a JPEG, PNG or WebP image.")
  }
  const bytes = Buffer.from(match[2], "base64")
  if (!bytes.length || bytes.length > PREVIEW_MAX_IMAGE_BYTES || bytes.toString("base64") !== match[2]) {
    throw problem(413, "IMAGE_TOO_LARGE", "The resized image must be at most 2 MiB.")
  }
  const validMagic = match[1] === "png"
    ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
    : match[1] === "jpeg"
      ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
  if (!validMagic) throw problem(415, "INVALID_IMAGE", "The file content does not match the image format.")
  return { imageDataUrl: body.imageDataUrl, sha256: createHash("sha256").update(bytes).digest("hex") }
}

export function normalizePreviewResult(result, inputSha256) {
  const value = result?.suggestion
  const provenance = value?.inferenceProvenance
  const size = provenance?.inferenceSize
  if (value?.analysisMode !== "live" || value.status !== "pending_review" ||
      value.modelKey !== "sam3" || provenance?.host !== "huggingface-zerogpu" ||
      provenance.models?.sam3?.id !== modelLock.sam3.id ||
      provenance.models?.sam3?.revision !== modelLock.sam3.revision ||
      provenance.models?.sam3?.sha256 !== modelLock.sam3.sha256 ||
      provenance.inputSha256 !== inputSha256 || !Number.isInteger(size?.width) ||
      !Number.isInteger(size?.height) || size.width < 1 || size.height < 1 ||
      size.width > 1600 || size.height > 1600) {
    throw problem(502, "INVALID_RESULT", "The inference service returned an unverifiable result.")
  }
  let visualEvidence = null
  const evidence = value.visualEvidence
  if (evidence?.maskDataUrl) {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(evidence.maskDataUrl)
    if (!match || match[1].length > Math.ceil(MAX_MASK_BYTES / 3) * 4) {
      throw problem(502, "INVALID_RESULT", "The inference mask exceeds the preview limits.")
    }
    const mask = Buffer.from(match[1], "base64")
    if (mask.length < 33 || mask.toString("base64") !== match[1] ||
        mask.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        mask.subarray(12, 16).toString() !== "IHDR" ||
        mask.readUInt32BE(16) !== size.width || mask.readUInt32BE(20) !== size.height ||
        evidence.maskWidth !== size.width || evidence.maskHeight !== size.height) {
      throw problem(502, "INVALID_RESULT", "The inference mask does not match the analyzed image.")
    }
    visualEvidence = { maskDataUrl: evidence.maskDataUrl, maskWidth: size.width, maskHeight: size.height }
  }
  const score = value.confidence
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) {
    throw problem(502, "INVALID_RESULT", "The model score is invalid.")
  }
  return {
    analysisMode: "live",
    status: "pending_review",
    modelKey: "sam3",
    modelLabel: "SAM 3",
    suggestedType: knownTypes.has(value.suggestedType) ? value.suggestedType : "other",
    confidence: score,
    visualEvidence,
    inferenceProvenance: { host: provenance.host, inputSha256, inferenceSize: { width: size.width, height: size.height } }
  }
}

async function readBody(request) {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += bytes.length
    if (length > PREVIEW_MAX_BODY_BYTES) throw problem(413, "IMAGE_TOO_LARGE", "Request exceeds 3 MiB.")
    chunks.push(bytes)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw problem(400, "INVALID_IMAGE", "Invalid JSON request.")
  }
}

function clientKey(request) {
  const forwarded = process.env.VERCEL ? request.headers["x-vercel-forwarded-for"] : null
  return typeof forwarded === "string" && isIP(forwarded.trim())
    ? forwarded.trim() : request.socket?.remoteAddress || "unknown"
}

export function createPreviewHandler({ infer = requestInference, limiter = new PreviewRateLimiter() } = {}) {
  const executor = new BoundedExecutor({ maxConcurrency: 1, maxQueue: 0 })
  return async function handlePreview(request, response, pathname) {
    const send = (statusCode, payload, retryAfter) => {
      const text = JSON.stringify(payload)
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw problem(502, "INVALID_RESULT", "Result exceeds preview limits.")
      response.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        ...(retryAfter ? { "retry-after": String(retryAfter) } : {})
      })
      response.end(text)
    }
    try {
      if (request.method === "GET" && pathname === "/api/preview/config") {
        return send(200, getPreviewConfig())
      }
      if (pathname !== "/api/preview/analyze" || request.method !== "POST") {
        throw problem(403, "WORKSPACE_PRIVATE", "The inspection workspace is not available in this public preview.")
      }
      const origin = request.headers.origin
      let sameOrigin = !origin
      try { if (origin) sameOrigin = new URL(origin).host === request.headers.host } catch { /* Reject malformed origins. */ }
      if (request.headers["sec-fetch-site"] === "cross-site" || !sameOrigin) {
        throw problem(403, "ORIGIN_REJECTED", "Use this application to submit an image.")
      }
      if (!/^application\/json(?:;|$)/i.test(request.headers["content-type"] || "")) {
        throw problem(415, "INVALID_IMAGE", "JSON image upload required.")
      }
      const endpointUrl = previewEndpoint()
      if (!endpointUrl) throw problem(503, "LIVE_UNAVAILABLE", "Live analysis is temporarily unavailable. Demo examples are still available.")
      limiter.take(clientKey(request))
      const payload = validatePreviewPayload(await readBody(request))
      const result = await executor.run(() => infer({
        endpointUrl, imageDataUrl: payload.imageDataUrl, modelKey: "sam3"
      }, { transport: "gradio", timeoutMs: 165_000 }))
      return send(200, { suggestion: normalizePreviewResult(result, payload.sha256), humanConfirmationRequired: true })
    } catch (error) {
      if (error instanceof InferenceQueueFullError) {
        return send(429, { code: "SERVICE_BUSY", error: "Another analysis is running. Please try later." }, 20)
      }
      const statusCode = error instanceof AppError ? error.statusCode : 503
      const ownError = error instanceof AppError && typeof error.code === "string"
      const code = ownError ? error.code : (statusCode === 429 ? "GPU_QUOTA_EXCEEDED" : statusCode === 504 ? "ANALYSIS_TIMEOUT" : "LIVE_UNAVAILABLE")
      // Provider errors may contain private URLs or headers. Only our own codes
      // carry their message; all other failures are deliberately normalized.
      const message = ownError ? error.message : "Live analysis could not complete. Demo examples are still available."
      return send(statusCode, { code, error: message }, error.retryAfter)
    }
  }
}

export const handlePublicPreview = createPreviewHandler()
