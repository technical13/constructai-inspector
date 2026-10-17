import { randomUUID } from "node:crypto"
import { defectCatalog, getDefectTypeMeta } from "./catalog.js"
import { reviewDecisions, transitionReviewDecision } from "../public/ai-review.js"
import { AppError } from "./app-error.js"
import { requestInference } from "./inference-gateway.js"
import { parseImageDataUrl } from "./image-data.js"
import {
  getCvInferenceMode,
  getCvModelUrl,
  getDefaultCvModelKey
} from "./runtime-config.js"

const inferableTypes = defectCatalog.filter((item) => item.id !== "other")
const knownTypeIds = new Set(defectCatalog.map((item) => item.id))
const legacyTypeAliases = new Map([["void", "honeycombing"]])

const cvModelSpecs = [
  {
    key: "deepcrack",
    label: "DeepCrack",
    family: "specialized",
    description: "Сегментация трещин в бетоне.",
    targetDefectTypes: ["crack"]
  },
  {
    key: "grounding-dino",
    label: "Grounding DINO",
    family: "general",
    description: "Zero-shot detector визуальных зон.",
    targetDefectTypes: ["crack", "spalling", "honeycombing", "corrosion", "leakage", "geometry", "unfinished"]
  },
  {
    key: "grounded-sam2",
    label: "Grounded SAM 2",
    family: "segmentation",
    description: "Детектор + SAM 2 для точной маски.",
    targetDefectTypes: ["crack"]
  },
  {
    key: "florence-2",
    label: "Florence-2",
    family: "foundation",
    description: "Модель общего visual reasoning.",
    targetDefectTypes: ["crack", "spalling", "honeycombing", "corrosion", "leakage", "geometry", "unfinished"]
  },
  {
    key: "universal-cv",
    label: "Universal CV Adapter",
    family: "adapter",
    description: "Контракт для внешней CV-модели.",
    targetDefectTypes: ["crack", "spalling", "honeycombing", "corrosion", "leakage", "geometry", "unfinished"]
  }
]

function getCvModelSpec(modelKey = getDefaultCvModelKey()) {
  return cvModelSpecs.find((item) => item.key === modelKey) || cvModelSpecs[0]
}

function isLocalEndpoint(endpointUrl) {
  try {
    const { hostname } = new URL(endpointUrl)
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
  } catch {
    return false
  }
}

export function getCvModels() {
  const defaultKey = getDefaultCvModelKey()

  return cvModelSpecs.map((item) => {
    const endpointUrl = getCvModelUrl(item.key)
    const configured = endpointUrl !== ""

    return {
      key: item.key,
      label: item.label,
      family: item.family,
      description: item.description,
      targetDefectTypes: item.targetDefectTypes,
      configured,
      statusLabel: configured
        ? isLocalEndpoint(endpointUrl)
          ? "Локальный CV-service"
          : "Endpoint подключён"
        : "Endpoint не подключён",
      defaultSelected: item.key === defaultKey
    }
  })
}

function getConfiguredCvModelSpecs() {
  return getCvModels()
    .filter((item) => item.configured)
    .map((item) => getCvModelSpec(item.key))
}

function clampConfidence(value) {
  const numeric = Number(value)

  if (value === null || value === undefined || !Number.isFinite(numeric)) {
    return null
  }

  return Math.max(0, Math.min(1, numeric))
}

function normalizeTypeId(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : ""
  const canonical = legacyTypeAliases.get(normalized) || normalized
  return knownTypeIds.has(canonical) ? canonical : "other"
}

function hashBuffer(buffer) {
  let hash = 2166136261

  for (const byte of buffer) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0)
}

function clamp01(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.max(0, Math.min(1, Number(numeric.toFixed(3))))
}

function createSeededRandom(seed) {
  let current = seed >>> 0 || 1

  return () => {
    current = (Math.imul(current, 1664525) + 1013904223) >>> 0
    return current / 4294967296
  }
}

function normalizePoint(point) {
  if (!point || typeof point !== "object") {
    return null
  }

  return {
    x: clamp01(point.x),
    y: clamp01(point.y)
  }
}

function normalizePositiveInteger(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Math.round(numeric)
}

function normalizeMaskDataUrl(value) {
  if (typeof value !== "string") {
    return ""
  }

  const trimmed = value.trim()
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(trimmed) ? trimmed : ""
}

function normalizeEvidence(value) {
  if (!value || typeof value !== "object") {
    return null
  }

  const normalized = {}

  if (typeof value.mimeType === "string" && value.mimeType.trim() !== "") {
    normalized.mimeType = value.mimeType.trim()
  }

  if (Number.isFinite(Number(value.bytes))) {
    normalized.bytes = Number(value.bytes)
  }

  if (Number.isFinite(Number(value.positivePixels))) {
    normalized.positivePixels = Number(value.positivePixels)
  }

  if (Number.isFinite(Number(value.threshold))) {
    normalized.threshold = Number(value.threshold)
  }

  return Object.keys(normalized).length > 0 ? normalized : null
}

function normalizeModelKey(value) {
  return getCvModelSpec(typeof value === "string" ? value.trim() : "").key
}

function normalizeRegion(region, index) {
  if (!region || typeof region !== "object") {
    return null
  }

  const kind =
    typeof region.kind === "string" && region.kind.trim() !== ""
      ? region.kind.trim()
      : "polyline"
  const normalized = {
    id:
      typeof region.id === "string" && region.id.trim() !== ""
        ? region.id.trim()
        : `region-${index + 1}`,
    kind,
    label:
      typeof region.label === "string" && region.label.trim() !== ""
        ? region.label.trim()
        : "Вероятная зона дефекта",
    confidence: clampConfidence(region.confidence)
  }

  if (kind === "box") {
    const x = clamp01(region.x)
    const y = clamp01(region.y)
    const width = clamp01(region.width)
    const height = clamp01(region.height)

    if (width <= 0 || height <= 0) {
      return null
    }

    normalized.x = x
    normalized.y = y
    normalized.width = Math.min(width, 1 - x)
    normalized.height = Math.min(height, 1 - y)
    return normalized
  }

  const points = Array.isArray(region.points)
    ? region.points.map(normalizePoint).filter(Boolean)
    : []

  if (points.length < (kind === "polygon" ? 3 : 2)) {
    return null
  }

  normalized.points = points
  return normalized
}

function normalizeVisualEvidence(value) {
  if (!value || typeof value !== "object") {
    return null
  }

  const maskDataUrl = normalizeMaskDataUrl(value.maskDataUrl)
  const maskWidth = normalizePositiveInteger(value.maskWidth)
  const maskHeight = normalizePositiveInteger(value.maskHeight)
  const regions = Array.isArray(value.regions)
    ? value.regions.map(normalizeRegion).filter(Boolean)
    : []

  if (!maskDataUrl && regions.length === 0) {
    return null
  }

  const normalized = {
    imageSpace: "normalized",
    regions
  }

  if (typeof value.renderMode === "string" && value.renderMode.trim() !== "") {
    normalized.renderMode = value.renderMode.trim()
  }

  if (maskDataUrl && maskWidth && maskHeight) {
    normalized.maskDataUrl = maskDataUrl
    normalized.maskWidth = maskWidth
    normalized.maskHeight = maskHeight
  }

  return normalized
}

function createPolylineRegion(random, regionIndex) {
  const points = []
  const segments = 7
  let x = 0.34 + random() * 0.22
  let y = 0.08 + random() * 0.06

  points.push({
    x: clamp01(x),
    y: clamp01(y)
  })

  for (let segment = 0; segment < segments; segment += 1) {
    const driftX = (random() - 0.5) * 0.14
    const driftY = 0.09 + random() * 0.06

    x = clamp01(x + driftX)
    y = clamp01(y + driftY)

    points.push({
      x,
      y
    })
  }

  return {
    id: `region-${regionIndex + 1}`,
    kind: "polyline",
    label: "Вероятная трещина",
    confidence: clampConfidence(0.56 + random() * 0.2),
    points
  }
}

function createVisualEvidence(fingerprint, suggestedType) {
  const random = createSeededRandom(fingerprint)

  if (suggestedType !== "crack") {
    const x = 0.12 + random() * 0.24
    const y = 0.14 + random() * 0.2
    const width = 0.34 + random() * 0.16
    const height = 0.34 + random() * 0.2

    return normalizeVisualEvidence({
      imageSpace: "normalized",
      regions: [
        {
          id: "region-1",
          kind: "box",
          label: "Вероятная зона дефекта",
          confidence: clampConfidence(0.52 + random() * 0.18),
          x,
          y,
          width,
          height
        }
      ]
    })
  }

  const regions = [createPolylineRegion(random, 0)]

  if (random() > 0.35) {
    const mainPoints = regions[0].points
    const pivot = mainPoints[2]

    regions.push({
      id: "region-2",
      kind: "polyline",
      label: "Ответвление",
      confidence: clampConfidence(0.5 + random() * 0.14),
      points: [
        pivot,
        {
          x: clamp01(pivot.x + 0.07 + random() * 0.05),
          y: clamp01(pivot.y + 0.08 + random() * 0.05)
        },
        {
          x: clamp01(pivot.x + 0.03 + random() * 0.04),
          y: clamp01(pivot.y + 0.16 + random() * 0.06)
        }
      ]
    })
  }

  return normalizeVisualEvidence({
    imageSpace: "normalized",
    regions
  })
}

function createMockSuggestion(
  imageDataUrl,
  now = new Date().toISOString(),
  modelKey = getDefaultCvModelKey()
) {
  if (!imageDataUrl) {
    throw new AppError(400, "Для AI-подсказки требуется изображение.")
  }

  const parsed = parseImageDataUrl(imageDataUrl)
  const fingerprint = hashBuffer(parsed.buffer)
  const model = getCvModelSpec(modelKey)
  const modelOffset = cvModelSpecs.findIndex((item) => item.key === model.key)
  const suggestedMeta = inferableTypes[(fingerprint + modelOffset) % inferableTypes.length]
  const confidence = clampConfidence(
    0.42 + ((fingerprint % 22) + 1) / 100 + modelOffset * 0.02
  )
  const visualEvidence = createVisualEvidence(fingerprint + modelOffset * 97, suggestedMeta.id)

  return {
    suggestionId: randomUUID(),
    analysisMode: "mock",
    source: "mock",
    sourceLabel: "Mock CV Adapter",
    modelKey: model.key,
    modelLabel: model.label,
    modelVersion: `mock-${model.key}-v1`,
    status: "pending_review",
    suggestedType: suggestedMeta.id,
    suggestedTypeLabel: suggestedMeta.label,
    confidence,
    rationale:
      `Демонстрационный inference-адаптер для ${model.label}. Реальный endpoint этой модели пока не подключён; тип выбран детерминированно по техническому отпечатку изображения только для проверки потока подтверждения.`,
    evidence: {
      mimeType: parsed.mimeType,
      bytes: parsed.buffer.length
    },
    visualEvidence,
    createdAt: now
  }
}

async function requestExternalSuggestion(imageDataUrl, now, modelKey) {
  const model = getCvModelSpec(modelKey)
  const endpointUrl = getCvModelUrl(model.key)

  if (!endpointUrl) {
    throw new AppError(
      400,
      `Модель ${model.label} ещё не подключена. Добавьте её endpoint или выберите другую модель.`
    )
  }

  const payload = await requestInference({
    endpointUrl,
    imageDataUrl,
    modelKey: model.key
  })
  const suggestion = payload?.suggestion

  if (!suggestion || typeof suggestion !== "object") {
    throw new AppError(502, "CV inference service вернул некорректный ответ.")
  }

  const normalized = {
    suggestionId: randomUUID(),
    analysisMode: "live",
    source:
      typeof suggestion.source === "string" && suggestion.source.trim() !== ""
        ? suggestion.source.trim()
        : "external",
    sourceLabel:
      typeof suggestion.sourceLabel === "string" && suggestion.sourceLabel.trim() !== ""
        ? suggestion.sourceLabel.trim()
        : "External CV Adapter",
    modelKey: normalizeModelKey(suggestion.modelKey || model.key),
    modelLabel:
      typeof suggestion.modelLabel === "string" && suggestion.modelLabel.trim() !== ""
        ? suggestion.modelLabel.trim()
        : model.label,
    modelVersion:
      typeof suggestion.modelVersion === "string" &&
      suggestion.modelVersion.trim() !== ""
        ? suggestion.modelVersion.trim()
        : "unknown",
    status: "pending_review",
    suggestedType: normalizeTypeId(suggestion.suggestedType),
    suggestedTypeLabel: getDefectTypeMeta(normalizeTypeId(suggestion.suggestedType)).label,
    confidence: clampConfidence(suggestion.confidence),
    rationale:
      typeof suggestion.rationale === "string" ? suggestion.rationale.trim() : "",
    evidence: normalizeEvidence(suggestion.evidence),
    visualEvidence: normalizeVisualEvidence(suggestion.visualEvidence),
    createdAt:
      typeof suggestion.createdAt === "string" && suggestion.createdAt.trim() !== ""
        ? suggestion.createdAt
        : now
  }

  return normalized
}

export async function suggestDefectFromImage(
  imageDataUrl,
  now = new Date().toISOString(),
  options = {}
) {
  const modelKey = normalizeModelKey(options.modelKey || getDefaultCvModelKey())
  const mode = getCvInferenceMode()

  if (mode === "disabled") {
    throw new AppError(503, "Live AI analysis is disabled. Use a precomputed demo or manual entry.")
  }

  if (mode === "mock") {
    return createMockSuggestion(imageDataUrl, now, modelKey)
  }

  try {
    return await requestExternalSuggestion(imageDataUrl, now, modelKey)
  } catch (error) {
    if (mode === "auto") {
      return createMockSuggestion(imageDataUrl, now, modelKey)
    }

    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(
      503,
      "CV inference service недоступен. Запустите DeepCrack adapter или переключите режим AI."
    )
  }
}

export async function compareDefectSuggestions(
  imageDataUrl,
  now = new Date().toISOString(),
  options = {}
) {
  const requestedKeys = Array.isArray(options.modelKeys) ? options.modelKeys : []
  const requestedSpecs = requestedKeys
    .map((modelKey) => getCvModelSpec(modelKey))
    .filter(
      (spec, index, array) =>
        array.findIndex((item) => item.key === spec.key) === index
    )
  const modelSpecs =
    requestedSpecs.length > 0 ? requestedSpecs : getConfiguredCvModelSpecs()

  if (modelSpecs.length === 0) {
    throw new AppError(
      400,
      "Нет подключённых AI-моделей для сравнения. Подключите хотя бы один endpoint."
    )
  }

  const settled = await Promise.all(
    modelSpecs.map(async (model) => {
      try {
        const suggestion = await suggestDefectFromImage(imageDataUrl, now, {
          modelKey: model.key
        })

        return {
          modelKey: model.key,
          modelLabel: model.label,
          ok: true,
          suggestion
        }
      } catch (error) {
        return {
          modelKey: model.key,
          modelLabel: model.label,
          ok: false,
          error: error instanceof Error ? error.message : "Неизвестная ошибка AI."
        }
      }
    })
  )

  if (!settled.some((item) => item.ok)) {
    throw new AppError(
      503,
      settled[0]?.error || "Ни одна AI-модель не смогла обработать изображение."
    )
  }

  return settled
}

export function finalizeAiSuggestion(
  suggestionInput,
  finalDefectType,
  now = new Date().toISOString(),
  { decision = "pending_review" } = {}
) {
  if (!suggestionInput || typeof suggestionInput !== "object") {
    return null
  }

  const suggestedType = normalizeTypeId(suggestionInput.suggestedType)
  const finalType = normalizeTypeId(finalDefectType)
  validateReviewAction(decision, suggestedType, finalType)
  const status = transitionReviewDecision("pending_review", decision, suggestedType, finalType)

  return {
    suggestionId: suggestionInput.suggestionId || randomUUID(),
    analysisMode: ["precomputed_demo", "mock", "live"].includes(suggestionInput.analysisMode)
      ? suggestionInput.analysisMode
      : suggestionInput.source === "mock" ? "mock" : "unknown",
    demoScenarioId: typeof suggestionInput.demoScenarioId === "string" ? suggestionInput.demoScenarioId : "",
    source:
      typeof suggestionInput.source === "string" && suggestionInput.source.trim() !== ""
        ? suggestionInput.source.trim()
        : "unknown",
    sourceLabel:
      typeof suggestionInput.sourceLabel === "string" &&
      suggestionInput.sourceLabel.trim() !== ""
        ? suggestionInput.sourceLabel.trim()
        : "Unknown Adapter",
    modelKey: normalizeModelKey(suggestionInput.modelKey || getDefaultCvModelKey()),
    modelLabel:
      typeof suggestionInput.modelLabel === "string" && suggestionInput.modelLabel.trim() !== ""
        ? suggestionInput.modelLabel.trim()
        : getCvModelSpec(suggestionInput.modelKey).label,
    modelVersion:
      typeof suggestionInput.modelVersion === "string" &&
      suggestionInput.modelVersion.trim() !== ""
        ? suggestionInput.modelVersion.trim()
        : "unknown",
    status,
    review: { version: 1, decision: status, reviewedAt: status === "pending_review" ? null : now },
    typeMatchesSuggestion: suggestedType === finalType,
    suggestedType,
    suggestedTypeLabel: getDefectTypeMeta(suggestedType).label,
    confidence: clampConfidence(suggestionInput.confidence),
    rationale:
      typeof suggestionInput.rationale === "string"
        ? suggestionInput.rationale.trim()
        : "",
    evidence: normalizeEvidence(suggestionInput.evidence),
    visualEvidence: normalizeVisualEvidence(suggestionInput.visualEvidence),
    createdAt:
      typeof suggestionInput.createdAt === "string" &&
      suggestionInput.createdAt.trim() !== ""
        ? suggestionInput.createdAt
        : now,
    reviewedAt: status === "pending_review" ? null : now,
    finalType,
    finalTypeLabel: getDefectTypeMeta(finalType).label
  }
}

function validateReviewAction(decision, suggestedType, finalType) {
  if (!reviewDecisions.includes(decision)) {
    throw new AppError(400, "Invalid AI review decision.")
  }
  if (decision === "accepted" && suggestedType !== finalType) {
    throw new AppError(400, "Accepting AI requires the suggested defect type.")
  }
}

export function updateAiSuggestionReview(suggestion, previousType, finalType, input, now) {
  if (!suggestion) {
    if (input.aiDecision && input.aiDecision !== "manual") {
      throw new AppError(400, "There is no AI suggestion to review.")
    }
    return null
  }
  const changedType = previousType !== finalType
  const explicitDecision = input.aiDecision !== undefined
  if (!changedType && !explicitDecision) return suggestion

  if (explicitDecision) {
    if (!suggestion.suggestionId || input.reviewSuggestionId !== suggestion.suggestionId) {
      throw new AppError(409, "AI suggestion changed. Reload before reviewing it.")
    }
    validateReviewAction(input.aiDecision, suggestion.suggestedType, finalType)
  }
  const decision = transitionReviewDecision(
    suggestion.review?.decision,
    explicitDecision ? input.aiDecision : "type_changed",
    suggestion.suggestedType,
    finalType
  )
  return {
    ...suggestion,
    status: decision,
    review: { version: 1, decision, reviewedAt: decision === "pending_review" ? null : now },
    reviewedAt: decision === "pending_review" ? null : now,
    typeMatchesSuggestion: suggestion.suggestedType === finalType,
    finalType,
    finalTypeLabel: getDefectTypeMeta(finalType).label
  }
}
