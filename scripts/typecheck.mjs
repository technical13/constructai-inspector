const requiredModules = [
  {
    path: "../api/index.js",
    keys: ["default"]
  },
  {
    path: "../src/api-handler.js",
    keys: ["handleApiRequest"]
  },
  {
    path: "../src/domain.js",
    keys: ["createProjectRecord", "createSessionRecord", "createDefectRecord", "updateDefectRecord"]
  },
  {
    path: "../src/report.js",
    keys: ["buildReportSnapshot", "renderReportHtml"]
  },
  {
    path: "../src/media-reference.js",
    keys: ["getPhotoAssetId", "getPhotoFileName", "getMimeTypeFromFileName"]
  },
  {
    path: "../src/runtime-config.js",
    keys: ["getStorageBackend", "isDemoLibraryWritable", "getCvInferenceTimeoutMs", "getCvInferenceMaxConcurrency", "getCvInferenceMaxQueue"]
  },
  {
    path: "../src/inference-gateway.js",
    keys: ["BoundedExecutor", "getInferencePolicy", "requestInference"]
  },
  {
    path: "../src/cv-benchmark.js",
    keys: ["validateCvBenchmarkManifest"]
  },
  {
    path: "../src/store.js",
    keys: ["createDefect", "createProject", "createReport", "createSession", "deleteDefect", "getMediaAsset", "getReportDocument", "getSessionBundle", "reanalyseDefect", "updateDefect"]
  }
]

for (const moduleSpec of requiredModules) {
  const moduleUrl = new URL(moduleSpec.path, import.meta.url)
  const loaded = await import(moduleUrl)

  for (const key of moduleSpec.keys) {
    if (!(key in loaded) || typeof loaded[key] === "undefined") {
      throw new Error(`typecheck: missing export "${key}" from ${moduleSpec.path}`)
    }
  }
}

console.log("typecheck: module contracts are present")
