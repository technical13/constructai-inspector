import assert from "node:assert/strict"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import { handleApiRequest } from "../src/api-handler.js"
import {
  createDefectRecord,
  createProjectRecord,
  createSessionRecord,
  updateDefectRecord
} from "../src/domain.js"
import {
  compareDefectSuggestions,
  finalizeAiSuggestion,
  getCvModels,
  suggestDefectFromImage
} from "../src/inference.js"
import { deleteDemoScenario, saveDemoScenario } from "../src/demo-scenarios.js"
import { parseImageDataUrl } from "../src/image-data.js"
import { getPhotoAssetId, getPhotoFileName } from "../src/media-reference.js"
import { buildReportSnapshot, renderReportHtml } from "../src/report.js"
import {
  getDefaultCvModelKey,
  getCvInferenceUrl,
  getStorageBackend,
  isDemoLibraryWritable
} from "../src/runtime-config.js"

function restoreEnv(name, value) {
  if (typeof value === "string") {
    process.env[name] = value
    return
  }

  delete process.env[name]
}

test("defect record keeps MVP1 invariants and future AI slots", () => {
  const defect = createDefectRecord(
    {
      sessionId: "session-1",
      defectType: "crack",
      comment: "Обнаружена трещина по штукатурному слою.",
      locationDescription: "Секция А, ось 3-4"
    },
    {
      id: "photo-1",
      fileName: "photo-1.jpg",
      mimeType: "image/jpeg",
      publicPath: "/uploads/photo-1.jpg"
    },
    "2026-04-12T10:00:00.000Z"
  )

  assert.equal(defect.sessionId, "session-1")
  assert.equal(defect.photos.length, 1)
  assert.equal(defect.aiSuggestion, null)
  assert.equal(defect.engineeringEvaluation, null)
})

test("defect record can be updated without losing photo and ai metadata", () => {
  const defect = createDefectRecord(
    {
      sessionId: "session-1",
      defectType: "crack",
      comment: "Первичная фиксация.",
      locationDescription: "Ось 1-2"
    },
    {
      id: "photo-1",
      fileName: "photo-1.jpg",
      mimeType: "image/jpeg",
      publicPath: "/uploads/photo-1.jpg"
    },
    "2026-04-12T10:00:00.000Z"
  )
  const updated = updateDefectRecord(
    {
      ...defect,
      aiSuggestion: {
        source: "deepcrack"
      }
    },
    {
      defectType: "spalling",
      comment: "После проверки уточнён тип.",
      locationDescription: "Ось 2-3"
    },
    "2026-04-12T10:05:00.000Z"
  )

  assert.equal(updated.photos.length, 1)
  assert.equal(updated.photos[0].id, "photo-1")
  assert.equal(updated.aiSuggestion.source, "deepcrack")
  assert.equal(updated.defectType, "spalling")
  assert.equal(updated.comment, "После проверки уточнён тип.")
  assert.equal(updated.locationDescription, "Ось 2-3")
  assert.equal(updated.updatedAt, "2026-04-12T10:05:00.000Z")
})

test("image parser rejects unsupported and empty image payloads", () => {
  assert.throws(
    () => parseImageDataUrl("data:image/svg+xml;base64,PHN2Zy8+"),
    /Формат изображения не поддерживается/
  )
  assert.throws(
    () => parseImageDataUrl("data:image/png;base64,===="),
    /Изображение не содержит данных/
  )
})

test("report html is generated from stored snapshot data", () => {
  const project = createProjectRecord(
    { name: "ЖК Северный" },
    "2026-04-12T08:00:00.000Z"
  )
  const session = createSessionRecord(
    { projectId: project.id, inspectorName: "Иванов И.И." },
    "2026-04-12T09:00:00.000Z"
  )
  const defect = createDefectRecord(
    {
      sessionId: session.id,
      defectType: "crack",
      comment: "Трещина в зоне примыкания.",
      locationDescription: "Подъезд 1, этаж 4",
      aiSuggestion: {
        source: "mock",
        sourceLabel: "Mock CV Adapter",
        modelVersion: "mock-cv-v1",
        status: "corrected",
        suggestedType: "spalling",
        suggestedTypeLabel: "Скол / разрушение защитного слоя",
        confidence: 0.46,
        rationale: "Demo",
        visualEvidence: {
          imageSpace: "normalized",
          maskDataUrl: "data:image/png;base64,ZmFrZS1tYXNr",
          maskWidth: 1280,
          maskHeight: 720,
          regions: [
            {
              id: "region-1",
              kind: "box",
              label: "Вероятная зона дефекта",
              confidence: 0.46,
              x: 0.2,
              y: 0.24,
              width: 0.32,
              height: 0.26
            }
          ]
        },
        createdAt: "2026-04-12T09:25:00.000Z",
        reviewedAt: "2026-04-12T09:29:00.000Z",
        finalType: "crack",
        finalTypeLabel: "Трещина"
      }
    },
    {
      id: "photo-1",
      fileName: "photo-1.jpg",
      mimeType: "image/jpeg",
      publicPath: "/uploads/photo-1.jpg"
    },
    "2026-04-12T09:30:00.000Z"
  )

  const snapshot = buildReportSnapshot({ project, session, defects: [defect] })
  const html = renderReportHtml(snapshot)

  assert.equal(snapshot.defects[0].photos[0].id, "photo-1")
  assert.equal(snapshot.defects[0].photos[0].fileName, "photo-1.jpg")
  assert.match(html, /ЖК Северный/)
  assert.match(html, /Трещина/)
  assert.match(html, /Подъезд 1, этаж 4/)
  assert.match(html, /detection-overlay/)
  assert.match(html, /detection-overlay__box/)
  assert.match(html, /inspection-photo__meta/)
  assert.match(html, />Трещина</)
  assert.match(html, /Отчёт воспроизводим из сохранённого снимка сессии/)
  assert.match(html, /--signal: #f2e600/)
  assert.match(html, /border-radius: 4px/)
  assert.match(html, /font-family: "IBM Plex Mono"/)
  assert.doesNotMatch(html, /box-shadow:/)
})

test("report html renders crack polyline evidence without collapsing it into a box", () => {
  const project = createProjectRecord(
    { name: "ЖК Полилиния" },
    "2026-04-12T08:00:00.000Z"
  )
  const session = createSessionRecord(
    { projectId: project.id, inspectorName: "Петров П.П." },
    "2026-04-12T09:00:00.000Z"
  )
  const defect = createDefectRecord(
    {
      sessionId: session.id,
      defectType: "crack",
      comment: "Длинная диагональная трещина.",
      locationDescription: "Лестничный марш",
      aiSuggestion: {
        source: "deepcrack",
        sourceLabel: "DeepCrack Segmentation",
        modelVersion: "deepcrack-ct260",
        status: "accepted",
        suggestedType: "crack",
        suggestedTypeLabel: "Трещина",
        confidence: 0.81,
        rationale: "Trace",
        visualEvidence: {
          imageSpace: "normalized",
          regions: [
            {
              id: "trace-1",
              kind: "polyline",
              label: "Трещина",
              confidence: 0.81,
              points: [
                { x: 0.2, y: 0.18 },
                { x: 0.31, y: 0.29 },
                { x: 0.43, y: 0.41 },
                { x: 0.55, y: 0.58 }
              ]
            }
          ]
        },
        createdAt: "2026-04-12T09:25:00.000Z",
        reviewedAt: "2026-04-12T09:29:00.000Z",
        finalType: "crack",
        finalTypeLabel: "Трещина"
      }
    },
    {
      id: "photo-2",
      fileName: "photo-2.jpg",
      mimeType: "image/jpeg",
      publicPath: "/uploads/photo-2.jpg"
    },
    "2026-04-12T09:30:00.000Z"
  )

  const html = renderReportHtml(
    buildReportSnapshot({ project, session, defects: [defect] })
  )

  assert.match(html, /detection-overlay__trace/)
  assert.match(html, /polyline/)
  assert.match(html, />Трещина</)
})

test("report html renders mask-first overlay for grounded sam2 evidence", () => {
  const project = createProjectRecord(
    { name: "ЖК SAM2" },
    "2026-04-12T08:00:00.000Z"
  )
  const session = createSessionRecord(
    { projectId: project.id, inspectorName: "Сидоров С.С." },
    "2026-04-12T09:00:00.000Z"
  )
  const defect = createDefectRecord(
    {
      sessionId: session.id,
      defectType: "crack",
      comment: "Тонкая усадочная трещина.",
      locationDescription: "Плита перекрытия",
      aiSuggestion: {
        source: "grounded-sam2",
        sourceLabel: "Grounded SAM 2",
        modelKey: "grounded-sam2",
        modelLabel: "Grounded SAM 2",
        modelVersion: "grounding-dino + sam2",
        status: "accepted",
        suggestedType: "crack",
        suggestedTypeLabel: "Трещина",
        confidence: 0.84,
        rationale: "Detector -> SAM2",
        visualEvidence: {
          imageSpace: "normalized",
          renderMode: "mask",
          maskDataUrl: "data:image/png;base64,ZmFrZS1tYXNr",
          maskWidth: 1280,
          maskHeight: 720,
          regions: [
            {
              id: "sam2-region-1",
              kind: "box",
              label: "Трещина",
              confidence: 0.84,
              x: 0.22,
              y: 0.18,
              width: 0.16,
              height: 0.34
            }
          ]
        },
        createdAt: "2026-04-12T09:25:00.000Z",
        reviewedAt: "2026-04-12T09:29:00.000Z",
        finalType: "crack",
        finalTypeLabel: "Трещина"
      }
    },
    {
      id: "photo-3",
      fileName: "photo-3.jpg",
      mimeType: "image/jpeg",
      publicPath: "/uploads/photo-3.jpg"
    },
    "2026-04-12T09:30:00.000Z"
  )

  const html = renderReportHtml(
    buildReportSnapshot({ project, session, defects: [defect] })
  )

  assert.match(html, /detection-overlay__mask/)
  assert.match(html, /Grounded SAM 2/)
  assert.match(html, />Трещина</)
})

test("report html renders english export when report locale is en", () => {
  const project = createProjectRecord(
    { name: "North Block" },
    "2026-04-12T08:00:00.000Z"
  )
  const session = createSessionRecord(
    { projectId: project.id, inspectorName: "John Smith" },
    "2026-04-12T09:00:00.000Z"
  )
  const defect = createDefectRecord(
    {
      sessionId: session.id,
      defectType: "crack",
      comment: "Thin crack near slab edge.",
      locationDescription: "Stair flight landing",
      aiSuggestion: {
        source: "grounded-sam2",
        sourceLabel: "Grounded SAM 2",
        modelKey: "grounded-sam2",
        modelLabel: "Grounded SAM 2",
        modelVersion: "grounding-dino + sam2",
        status: "accepted",
        suggestedType: "crack",
        suggestedTypeLabel: "Трещина",
        confidence: 0.84,
        rationale: "Detector -> SAM2",
        visualEvidence: {
          imageSpace: "normalized",
          renderMode: "mask",
          maskDataUrl: "data:image/png;base64,ZmFrZS1tYXNr",
          maskWidth: 1280,
          maskHeight: 720,
          regions: [
            {
              id: "sam2-region-1",
              kind: "box",
              label: "Трещина",
              confidence: 0.84,
              x: 0.22,
              y: 0.18,
              width: 0.16,
              height: 0.34
            }
          ]
        },
        createdAt: "2026-04-12T09:25:00.000Z",
        reviewedAt: "2026-04-12T09:29:00.000Z",
        finalType: "crack",
        finalTypeLabel: "Трещина"
      }
    },
    {
      id: "photo-en-1",
      fileName: "photo-en-1.jpg",
      mimeType: "image/jpeg",
      publicPath: "/uploads/photo-en-1.jpg"
    },
    "2026-04-12T09:30:00.000Z"
  )

  const snapshot = buildReportSnapshot({
    project,
    session,
    defects: [defect],
    reportLocale: "en"
  })
  const html = renderReportHtml(snapshot)

  assert.equal(snapshot.reportLocale, "en")
  assert.match(html, /<html lang="en">/)
  assert.match(html, /Construction inspection report/)
  assert.match(html, /Defect inspection report/)
  assert.match(html, /Summary/)
  assert.match(html, /Defect list/)
  assert.match(html, />Crack</)
  assert.match(html, /AI suggested: Crack/)
})

test("mock inference returns a reviewable AI suggestion", async () => {
  const previousMode = process.env.CV_INFERENCE_MODE
  process.env.CV_INFERENCE_MODE = "mock"

  const suggestion = await suggestDefectFromImage(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHj8uoAAAAASUVORK5CYII=",
    "2026-04-13T10:00:00.000Z"
  )

  restoreEnv("CV_INFERENCE_MODE", previousMode)

  assert.equal(suggestion.source, "mock")
  assert.equal(suggestion.modelKey, "grounded-sam2")
  assert.equal(suggestion.modelLabel, "Grounded SAM 2")
  assert.equal(suggestion.modelVersion, "mock-grounded-sam2-v1")
  assert.equal(suggestion.status, "pending_review")
  assert.notEqual(suggestion.suggestedType, "other")
  assert.ok(suggestion.visualEvidence)
  assert.ok(Array.isArray(suggestion.visualEvidence.regions))
  assert.ok(suggestion.visualEvidence.regions.length >= 1)
  assert.equal(suggestion.createdAt, "2026-04-13T10:00:00.000Z")
})

test("cv model registry exposes active and prepared adapters", () => {
  const models = getCvModels()

  assert.ok(models.length >= 5)
  assert.equal(getDefaultCvModelKey(), "grounded-sam2")
  assert.ok(models.some((item) => item.key === "grounded-sam2" && item.defaultSelected))
  assert.ok(models.some((item) => item.key === "grounding-dino" && item.configured))
  assert.ok(models.some((item) => item.key === "grounded-sam2" && item.configured))
  assert.ok(models.some((item) => item.key === "florence-2" && item.configured))
  assert.ok(models.every((item) => typeof item.statusLabel === "string" && item.statusLabel !== ""))
})

test("mock inference respects selected model key", async () => {
  const previousMode = process.env.CV_INFERENCE_MODE
  process.env.CV_INFERENCE_MODE = "mock"

  const suggestion = await suggestDefectFromImage(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHj8uoAAAAASUVORK5CYII=",
    "2026-04-13T10:00:00.000Z",
    { modelKey: "florence-2" }
  )

  restoreEnv("CV_INFERENCE_MODE", previousMode)

  assert.equal(suggestion.modelKey, "florence-2")
  assert.equal(suggestion.modelLabel, "Florence-2")
  assert.match(suggestion.modelVersion, /florence-2/)
})

test("compare inference returns multiple model results in mock mode", async () => {
  const previousMode = process.env.CV_INFERENCE_MODE
  process.env.CV_INFERENCE_MODE = "mock"

  const results = await compareDefectSuggestions(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHj8uoAAAAASUVORK5CYII=",
    "2026-04-13T10:00:00.000Z",
    {
      modelKeys: ["deepcrack", "grounding-dino", "grounded-sam2", "florence-2"]
    }
  )

  restoreEnv("CV_INFERENCE_MODE", previousMode)

  assert.equal(results.length, 4)
  assert.ok(results.every((item) => item.ok))
  assert.equal(results[0].suggestion.createdAt, "2026-04-13T10:00:00.000Z")
})

test("finalized AI suggestion tracks whether operator accepted or corrected it", () => {
  const accepted = finalizeAiSuggestion(
    {
      source: "mock",
      sourceLabel: "Mock CV Adapter",
      modelVersion: "mock-cv-v1",
      suggestedType: "crack",
      confidence: 0.59,
      rationale: "Demo",
      visualEvidence: {
        imageSpace: "normalized",
        maskDataUrl: "data:image/png;base64,ZmFrZS1tYXNr",
        maskWidth: 1600,
        maskHeight: 900,
        regions: [
          {
            id: "region-1",
            kind: "polyline",
            label: "Вероятная трещина",
            confidence: 0.59,
            points: [
              { x: 0.2, y: 0.2 },
              { x: 0.4, y: 0.52 }
            ]
          }
        ]
      },
      createdAt: "2026-04-13T10:00:00.000Z"
    },
    "crack",
    "2026-04-13T10:05:00.000Z",
    { decision: "accepted" }
  )
  const corrected = finalizeAiSuggestion(
    {
      source: "mock",
      sourceLabel: "Mock CV Adapter",
      modelVersion: "mock-cv-v1",
      suggestedType: "crack",
      confidence: 0.59,
      rationale: "Demo",
      visualEvidence: {
        imageSpace: "normalized",
        regions: [
          {
            id: "region-1",
            kind: "polyline",
            label: "Вероятная трещина",
            confidence: 0.59,
            points: [
              { x: 0.2, y: 0.2 },
              { x: 0.4, y: 0.52 }
            ]
          }
        ]
      },
      createdAt: "2026-04-13T10:00:00.000Z"
    },
    "leakage",
    "2026-04-13T10:05:00.000Z",
    { decision: "corrected" }
  )

  assert.equal(accepted.status, "accepted")
  assert.equal(accepted.finalType, "crack")
  assert.ok(accepted.visualEvidence)
  assert.equal(accepted.visualEvidence.maskWidth, 1600)
  assert.equal(accepted.visualEvidence.maskHeight, 900)
  assert.equal(accepted.visualEvidence.maskDataUrl, "data:image/png;base64,ZmFrZS1tYXNr")
  assert.equal(accepted.visualEvidence.regions.length, 1)
  assert.equal(corrected.status, "corrected")
  assert.equal(corrected.finalType, "leakage")
  assert.equal(corrected.finalTypeLabel, "Протечка / увлажнение")
  assert.ok(corrected.visualEvidence)
  assert.equal(corrected.visualEvidence.regions.length, 1)
})

test("legacy CV void type is normalized to the honeycombing domain type", () => {
  const suggestion = finalizeAiSuggestion(
    {
      source: "legacy-cv",
      suggestedType: "void",
      confidence: 0.7
    },
    "honeycombing",
    "2026-07-13T10:00:00.000Z"
  )

  assert.equal(suggestion.suggestedType, "honeycombing")
  assert.equal(suggestion.finalType, "honeycombing")
  assert.equal(suggestion.status, "pending_review")
})

test("legacy report photo references retain a resolvable local asset identity", () => {
  const apiPhoto = {
    publicPath: "/api/media/58111485-70f0-48e0-967b-a0f58e40a2b7",
    mimeType: "image/jpeg"
  }
  const uploadPhoto = {
    publicPath: "/uploads/photo-legacy.png",
    mimeType: "image/png"
  }

  assert.equal(getPhotoAssetId(apiPhoto), "58111485-70f0-48e0-967b-a0f58e40a2b7")
  assert.equal(
    getPhotoFileName(apiPhoto),
    "58111485-70f0-48e0-967b-a0f58e40a2b7.jpg"
  )
  assert.equal(getPhotoAssetId(uploadPhoto), "photo-legacy")
  assert.equal(getPhotoFileName(uploadPhoto), "photo-legacy.png")
})

test("storage backend defaults to local without cloud configuration", () => {
  const previousBackend = process.env.STORAGE_BACKEND
  const previousDatabaseUrl = process.env.DATABASE_URL
  const previousPostgresUrl = process.env.POSTGRES_URL

  delete process.env.STORAGE_BACKEND
  delete process.env.DATABASE_URL
  delete process.env.POSTGRES_URL

  assert.equal(getStorageBackend(), "local")

  restoreEnv("STORAGE_BACKEND", previousBackend)
  restoreEnv("DATABASE_URL", previousDatabaseUrl)
  restoreEnv("POSTGRES_URL", previousPostgresUrl)
})

test("storage backend switches to postgres when database url is configured", () => {
  const previousBackend = process.env.STORAGE_BACKEND
  const previousDatabaseUrl = process.env.DATABASE_URL

  delete process.env.STORAGE_BACKEND
  process.env.DATABASE_URL = "postgres://demo:demo@localhost:5432/demo"

  assert.equal(getStorageBackend(), "postgres")

  restoreEnv("STORAGE_BACKEND", previousBackend)
  restoreEnv("DATABASE_URL", previousDatabaseUrl)
})

test("demo library is writable locally and read-only on Vercel", () => {
  const previousVercel = process.env.VERCEL
  const previousOverride = process.env.DEMO_LIBRARY_WRITABLE

  delete process.env.VERCEL
  delete process.env.DEMO_LIBRARY_WRITABLE
  assert.equal(isDemoLibraryWritable(), true)

  process.env.VERCEL = "1"
  assert.equal(isDemoLibraryWritable(), false)

  process.env.DEMO_LIBRARY_WRITABLE = "true"
  assert.equal(isDemoLibraryWritable(), true)

  restoreEnv("VERCEL", previousVercel)
  restoreEnv("DEMO_LIBRARY_WRITABLE", previousOverride)
})

test("Vercel does not advertise a developer loopback CV endpoint", () => {
  const envNames = [
    "VERCEL",
    "CV_INFERENCE_URL",
    "DEEPCRACK_INFERENCE_URL",
    "GROUNDING_DINO_INFERENCE_URL",
    "GROUNDED_SAM2_INFERENCE_URL",
    "FLORENCE2_INFERENCE_URL",
    "GENERAL_CV_INFERENCE_URL"
  ]
  const previousValues = new Map(envNames.map((name) => [name, process.env[name]]))

  try {
    process.env.VERCEL = "1"
    for (const name of envNames.slice(1)) {
      delete process.env[name]
    }

    assert.equal(getCvInferenceUrl(), "")
    assert.ok(getCvModels().every((model) => model.configured === false))

    process.env.GROUNDED_SAM2_INFERENCE_URL = "https://cv.example.test"
    const groundedSam = getCvModels().find((model) => model.key === "grounded-sam2")
    assert.equal(groundedSam.configured, true)
    assert.equal(groundedSam.statusLabel, "Endpoint подключён")
  } finally {
    for (const [name, value] of previousValues) {
      restoreEnv(name, value)
    }
  }
})

test("demo mutation API rejects writes in a read-only deployment", async () => {
  const previousVercel = process.env.VERCEL
  const previousOverride = process.env.DEMO_LIBRARY_WRITABLE
  process.env.VERCEL = "1"
  delete process.env.DEMO_LIBRARY_WRITABLE

  let statusCode = 0
  let responseBody = ""
  const response = {
    writeHead(status) {
      statusCode = status
    },
    end(body = "") {
      responseBody = String(body)
    }
  }

  await handleApiRequest(
    { method: "DELETE" },
    response,
    "/api/demo-scenarios/non-existent"
  )

  restoreEnv("VERCEL", previousVercel)
  restoreEnv("DEMO_LIBRARY_WRITABLE", previousOverride)

  assert.equal(statusCode, 403)
  assert.equal(
    JSON.parse(responseBody).error,
    "Demo-библиотека доступна только для чтения."
  )
})

test("demo scenario can be saved from a successful local analysis", async () => {
  const publicDir = await fs.mkdtemp(path.join(os.tmpdir(), "constructai-demo-"))
  const scenario = await saveDemoScenario(
    {
      title: "Тонкая трещина",
      imageDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHj8uoAAAAASUVORK5CYII=",
      finalType: "crack",
      locationDescription: "Лестничный марш",
      comment: "Хороший demo-кейс с тонкой трещиной.",
      suggestion: {
        source: "grounded-sam2",
        sourceLabel: "Grounded SAM 2",
        modelKey: "grounded-sam2",
        modelLabel: "Grounded SAM 2",
        modelVersion: "sam2-demo",
        suggestedType: "crack",
        confidence: 0.74,
        rationale: "Demo",
        visualEvidence: {
          imageSpace: "normalized",
          renderMode: "mask",
          maskDataUrl: "data:image/png;base64,ZmFrZS1tYXNr",
          maskWidth: 100,
          maskHeight: 100,
          regions: [
            {
              id: "region-1",
              kind: "box",
              label: "Трещина",
              confidence: 0.74,
              x: 0.2,
              y: 0.3,
              width: 0.2,
              height: 0.1
            }
          ]
        }
      }
    },
    { publicDir }
  )

  const scenariosPath = path.join(publicDir, "demo", "scenarios.json")
  const imagePath = path.join(publicDir, "demo", "images", path.basename(scenario.imageUrl))
  const payload = JSON.parse(await fs.readFile(scenariosPath, "utf8"))

  assert.equal(payload.scenarios.length, 1)
  assert.equal(payload.scenarios[0].title, "Тонкая трещина")
  assert.equal(payload.scenarios[0].titleEn, "Crack example")
  assert.equal(
    payload.scenarios[0].descriptionEn,
    "Saved from local Grounded SAM 2 analysis."
  )
  assert.equal(
    payload.scenarios[0].commentEn,
    "A crack has been detected. Clarify the location, extent, and visible characteristics of the defect."
  )
  assert.equal(payload.scenarios[0].suggestion.finalType, "crack")
  assert.equal(payload.scenarios[0].suggestion.status, "pending_review")
  assert.match(payload.scenarios[0].imageUrl, /^\/demo\/images\/.+\.png$/)
  assert.doesNotMatch(path.basename(payload.scenarios[0].imageUrl), /[^\x00-\x7F]/)
  await fs.access(imagePath)
})

test("demo scenario deletion removes scenario record and image file", async () => {
  const publicDir = await fs.mkdtemp(path.join(os.tmpdir(), "constructai-demo-delete-"))
  const scenario = await saveDemoScenario(
    {
      title: "Удаляемый demo",
      imageDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WHj8uoAAAAASUVORK5CYII=",
      finalType: "crack",
      suggestion: {
        source: "grounded-sam2",
        sourceLabel: "Grounded SAM 2",
        modelKey: "grounded-sam2",
        modelLabel: "Grounded SAM 2",
        modelVersion: "sam2-demo",
        suggestedType: "crack",
        confidence: 0.74,
        rationale: "Demo",
        visualEvidence: {
          imageSpace: "normalized",
          renderMode: "mask",
          maskDataUrl: "data:image/png;base64,ZmFrZS1tYXNr",
          maskWidth: 100,
          maskHeight: 100,
          regions: [
            {
              id: "region-1",
              kind: "box",
              label: "Трещина",
              confidence: 0.74,
              x: 0.2,
              y: 0.3,
              width: 0.2,
              height: 0.1
            }
          ]
        }
      }
    },
    { publicDir }
  )

  const imagePath = path.join(publicDir, "demo", "images", path.basename(scenario.imageUrl))
  await deleteDemoScenario(scenario.id, { publicDir })
  const payload = JSON.parse(
    await fs.readFile(path.join(publicDir, "demo", "scenarios.json"), "utf8")
  )

  assert.equal(payload.scenarios.length, 0)
  await assert.rejects(() => fs.access(imagePath))
})
