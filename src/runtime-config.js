function readNonEmptyEnv(name) {
  const value = process.env[name]
  return typeof value === "string" && value.trim() !== "" ? value.trim() : ""
}

function readBoundedInteger(name, fallback, minimum, maximum) {
  const raw = readNonEmptyEnv(name)
  if (raw === "") {
    return fallback
  }
  const value = Number(raw)

  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    return fallback
  }

  return value
}

function hasPostgresConfig() {
  return Boolean(readNonEmptyEnv("DATABASE_URL") || readNonEmptyEnv("POSTGRES_URL"))
}

const supportedCvModelKeys = new Set([
  "deepcrack",
  "grounding-dino",
  "grounded-sam2",
  "florence-2",
  "universal-cv"
])

export function getStorageBackend() {
  const explicit = readNonEmptyEnv("STORAGE_BACKEND").toLowerCase()

  if (explicit === "local" || explicit === "postgres") {
    return explicit
  }

  return hasPostgresConfig() ? "postgres" : "local"
}

export function getDatabaseUrl() {
  return readNonEmptyEnv("DATABASE_URL") || readNonEmptyEnv("POSTGRES_URL")
}

export function getBlobToken() {
  return readNonEmptyEnv("BLOB_READ_WRITE_TOKEN")
}

export function isBlobEnabled() {
  return getBlobToken() !== ""
}

export function isDemoLibraryWritable() {
  const explicit = readNonEmptyEnv("DEMO_LIBRARY_WRITABLE").toLowerCase()

  if (["1", "true", "yes"].includes(explicit)) {
    return true
  }

  if (["0", "false", "no"].includes(explicit)) {
    return false
  }

  return readNonEmptyEnv("VERCEL") === ""
}

export function getCvInferenceUrl() {
  const explicit = readNonEmptyEnv("CV_INFERENCE_URL")

  if (explicit) {
    return explicit.replace(/\/$/, "")
  }

  // A serverless deployment cannot reach the developer's loopback interface.
  // Keep the local default only for an explicitly local runtime.
  if (readNonEmptyEnv("VERCEL") !== "") {
    return ""
  }

  return "http://127.0.0.1:8001"
}

export function getDefaultCvModelKey() {
  const explicit = readNonEmptyEnv("CV_MODEL_DEFAULT").toLowerCase()

  if (supportedCvModelKeys.has(explicit)) {
    return explicit
  }

  return "grounded-sam2"
}

export function getCvModelUrl(modelKey) {
  switch ((modelKey || "").trim()) {
    case "deepcrack":
      return readNonEmptyEnv("DEEPCRACK_INFERENCE_URL") || getCvInferenceUrl()
    case "grounding-dino":
      return readNonEmptyEnv("GROUNDING_DINO_INFERENCE_URL") || getCvInferenceUrl()
    case "grounded-sam2":
      return readNonEmptyEnv("GROUNDED_SAM2_INFERENCE_URL") || getCvInferenceUrl()
    case "florence-2":
      return readNonEmptyEnv("FLORENCE2_INFERENCE_URL") || getCvInferenceUrl()
    case "universal-cv":
      return readNonEmptyEnv("GENERAL_CV_INFERENCE_URL")
    default:
      return ""
  }
}

export function getCvInferenceMode() {
  const explicit = readNonEmptyEnv("CV_INFERENCE_MODE").toLowerCase()

  if (explicit === "mock" || explicit === "external" || explicit === "auto") {
    return explicit
  }

  return "external"
}

export function getCvInferenceTimeoutMs() {
  return readBoundedInteger("CV_INFERENCE_TIMEOUT_MS", 120_000, 1_000, 600_000)
}

export function getCvInferenceMaxConcurrency() {
  return readBoundedInteger("CV_INFERENCE_MAX_CONCURRENCY", 1, 1, 8)
}

export function getCvInferenceMaxQueue() {
  return readBoundedInteger("CV_INFERENCE_MAX_QUEUE", 8, 0, 64)
}
