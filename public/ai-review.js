// Shared by the browser and server: matching a model type is not consent.
export const reviewDecisions = ["pending_review", "accepted", "corrected", "manual"]

export function getReviewDecision(suggestion) {
  if (!suggestion) return "manual_entry"
  if (suggestion.review?.version === 1 && reviewDecisions.includes(suggestion.review.decision)) {
    return suggestion.review.decision
  }
  return suggestion.status === "pending_review" ? "pending_review" : "legacy_unverified"
}

export function transitionReviewDecision(previous, action, suggestedType, finalType) {
  if (action === "manual" || (action === "type_changed" && previous === "manual")) {
    return "manual"
  }
  if (action === "accepted") {
    return suggestedType === finalType ? "accepted" : "pending_review"
  }
  if (action === "corrected" || action === "type_changed") {
    return suggestedType !== finalType ? "corrected" : "pending_review"
  }
  return "pending_review"
}

const decisionLabels = {
  en: {
    accepted: "AI accepted",
    corrected: "AI corrected",
    manual: "Manual selection",
    pending_review: "AI suggestion pending",
    manual_entry: "Manual entry",
    legacy_unverified: "Review not recorded (legacy)"
  },
  ru: {
    accepted: "Тип AI принят",
    corrected: "Тип AI исправлен",
    manual: "Ручной выбор",
    pending_review: "AI-подсказка ожидает решения",
    manual_entry: "Ручной ввод",
    legacy_unverified: "Решение не зафиксировано (старая запись)"
  }
}

export function getReviewLabel(suggestion, locale = "ru") {
  return decisionLabels[locale === "en" ? "en" : "ru"][getReviewDecision(suggestion)]
}

export function getModelScoreText(value, locale = "ru") {
  const score = typeof value === "number" && Number.isFinite(value)
    ? `${Math.round(value * 100)}%`
    : locale === "en" ? "not provided" : "не указан"
  return `${locale === "en" ? "Model score" : "Оценка модели"}: ${score}`
}

export function getAnalysisLabel(suggestion, locale = "ru") {
  if (suggestion?.analysisMode === "precomputed_demo") {
    return locale === "en" ? "Demo Mode · Precomputed AI result" : "Демо · Сохранённый результат AI"
  }
  if (suggestion?.source === "mock" || suggestion?.analysisMode === "mock") {
    return locale === "en" ? "Mock output · Test data" : "Mock · Тестовые данные"
  }
  return locale === "en" ? "Saved model output" : "Сохранённый результат модели"
}

export function localizeRegionLabel(label, fallback, locale = "ru") {
  const normalized = String(label || "").trim().toLowerCase().replace(/^вероятная\s+/, "")
  const terms = [
    ["трещина", "crack", "Трещина", "Crack"],
    ["раковина", "honeycombing", "Раковина", "Honeycombing"],
    ["скол", "spalling", "Скол", "Spalling"],
    ["коррозия", "corrosion", "Коррозия", "Corrosion"],
    ["протечка", "leakage", "Протечка", "Leakage"]
  ]
  const term = terms.find((item) => item[0] === normalized || item[1] === normalized)
  return term ? term[locale === "en" ? 3 : 2] : String(fallback || "").trim()
}
