import {
  getReviewLabel, transitionReviewDecision,
  getModelScoreText, getAnalysisLabel, localizeRegionLabel
} from "./ai-review.js"

const state = {
  defectCatalog: [],
  projects: [],
  locale: localStorage.getItem("constructai.locale") === "en" ? "en" : "ru",
  selectedProjectId: localStorage.getItem("constructai.selectedProjectId") || "",
  currentSessionId: localStorage.getItem("constructai.currentSessionId") || "",
  currentSessionBundle: null,
  cvModels: [],
  selectedCvModelKey: localStorage.getItem("constructai.selectedCvModelKey") || "",
  demoScenarios: [],
  demoLibraryWritable: false,
  activeDemoScenarioId: "",
  pendingImageDataUrl: "",
  pendingSuggestion: null,
  aiDecision: "pending_review",
  comparisonResults: [],
  suggestionStatus: "idle",
  suggestionError: "",
  suggestionRequestId: 0,
  demoSaveState: "idle",
  demoDeletingId: "",
  uiStep: "project",
  editingDefectId: ""
}

const translations = {
  ru: {
    "document.title": "ConstructAI Inspector",
    "brand.caption": "Фиксация дефектов",
    "masthead.note": "Фото. AI. Акт.",
    "stepper.project": "Объект",
    "stepper.session": "Сессия",
    "stepper.defect": "Дефект",
    "stepper.report": "Акт",
    "project.eyebrow": "Текущий объект",
    "project.title": "Выберите объект",
    "project.label": "Объект",
    "project.continue": "Продолжить",
    "project.new.summary": "Новый объект",
    "project.new.name": "Название",
    "project.new.namePlaceholder": "Монолитная лестница, секция Б",
    "project.new.address": "Адрес",
    "project.new.addressPlaceholder": "г. Новосибирск, ул. ...",
    "project.new.description": "Короткая заметка",
    "project.new.descriptionPlaceholder": "Например: распалубка, визуальный осмотр маршей",
    "project.new.create": "Создать объект",
    "session.eyebrow": "Новая сессия",
    "session.title": "Откройте сессию",
    "session.inspector": "Инспектор",
    "session.inspectorPlaceholder": "ФИО инспектора",
    "session.noteSummary": "Заметка к сессии",
    "session.notePlaceholder": "Необязательно. Например: обход 5 этажа",
    "session.open": "Открыть сессию",
    "session.continue": "К осмотру",
    "defect.photoEyebrow": "Фото",
    "defect.photoTitle": "Фиксация дефекта",
    "demo.eyebrow": "Demo Mode",
    "demo.title": "Демо-примеры",
    "demo.meta": "Результаты рассчитаны заранее",
    "demo.note": "Показывается ранее полученная маска. Новый анализ не запускается.",
    "demo.saveEyebrow": "Demo Mode",
    "demo.saveTitle": "Добавить в демо",
    "demo.saveCopy": "Если результат удачный, добавьте этот кейс в публичную demo-подборку.",
    "demo.saveLabel": "Название примера",
    "demo.savePlaceholder": "Например: Тонкая трещина на марше",
    "demo.saveButton": "Отправить в демо",
    "demo.dismissButton": "Не сохранять",
    "demo.deleteButton": "Удалить",
    "defect.ownPhoto": "Своя фотография",
    "defect.choosePhoto": "Выбрать фото",
    "defect.noPhotoSelected": "Фото не выбрано",
    "defect.aiModel": "AI-модель",
    "defect.previewEmpty": "Снимите фото или выберите его из галереи",
    "defect.aiTitle": "AI-подсказка",
    "defect.acceptSuggestion": "Принять тип",
    "defect.dismissSuggestion": "Оставить вручную",
    "defect.descriptionEyebrow": "Описание",
    "defect.descriptionTitle": "Проверьте и сохраните",
    "defect.type": "Тип дефекта",
    "defect.toReport": "К акту",
    "defect.save": "Сохранить дефект",
    "report.eyebrow": "Акт",
    "report.title": "Акт",
    "report.reanalyseModel": "Модель анализа",
    "report.newDefect": "Новый дефект",
    "report.generate": "Сформировать акт",
    "report.defectsTitle": "Сохранённые дефекты",
    "report.generatedTitle": "Готовые акты",
    "common.back": "Назад",
    "common.comment": "Комментарий",
    "common.commentPlaceholder": "Короткое структурированное описание",
    "common.location": "Участок",
    "common.locationPlaceholder": "Например: наружный угол марша, нижняя плоскость",
    "step.project.kicker": "Шаг 1 · Объект",
    "step.project.title": "Выбор объекта",
    "step.project.copy": "Выберите объект или создайте новый.",
    "step.session.kicker": "Шаг 2 · Сессия",
    "step.session.title": "Рабочая сессия",
    "step.session.copy": "Откройте сессию или продолжите её.",
    "step.defect.kicker": "Шаг 3 · Дефект",
    "step.defect.title": "Фото и тип",
    "step.defect.copy": "Фото, AI-подсказка, подтверждение.",
    "step.report.kicker": "Шаг 4 · Акт",
    "step.report.title": "Акт",
    "step.report.copy": "Проверьте дефекты и сформируйте акт."
  },
  en: {
    "document.title": "ConstructAI Inspector",
    "brand.caption": "Defect capture",
    "masthead.note": "Photo. AI. Report.",
    "stepper.project": "Project",
    "stepper.session": "Session",
    "stepper.defect": "Defect",
    "stepper.report": "Report",
    "project.eyebrow": "Current project",
    "project.title": "Choose a project",
    "project.label": "Project",
    "project.continue": "Continue",
    "project.new.summary": "New project",
    "project.new.name": "Name",
    "project.new.namePlaceholder": "Monolithic staircase, section B",
    "project.new.address": "Address",
    "project.new.addressPlaceholder": "Novosibirsk, ... street",
    "project.new.description": "Short note",
    "project.new.descriptionPlaceholder": "For example: stripping, visual inspection of stair flights",
    "project.new.create": "Create project",
    "session.eyebrow": "New session",
    "session.title": "Open a session",
    "session.inspector": "Inspector",
    "session.inspectorPlaceholder": "Inspector full name",
    "session.noteSummary": "Session note",
    "session.notePlaceholder": "Optional. For example: 5th floor walkthrough",
    "session.open": "Open session",
    "session.continue": "To inspection",
    "defect.photoEyebrow": "Photo",
    "defect.photoTitle": "Capture defect",
    "demo.eyebrow": "Demo Mode",
    "demo.title": "Demo examples",
    "demo.meta": "Precomputed AI results",
    "demo.note": "This example uses a previously generated segmentation mask. No live inference runs.",
    "demo.saveEyebrow": "Demo Mode",
    "demo.saveTitle": "Add to demo",
    "demo.saveCopy": "If the result looks good, add this case to the public demo set.",
    "demo.saveLabel": "Example name",
    "demo.savePlaceholder": "For example: Thin crack on the stair flight",
    "demo.saveButton": "Add to demo",
    "demo.dismissButton": "Do not save",
    "demo.deleteButton": "Delete",
    "defect.ownPhoto": "Your own photo",
    "defect.choosePhoto": "Choose photo",
    "defect.noPhotoSelected": "No photo selected",
    "defect.aiModel": "AI model",
    "defect.previewEmpty": "Take a photo or choose one from the gallery",
    "defect.aiTitle": "AI suggestion",
    "defect.acceptSuggestion": "Accept type",
    "defect.dismissSuggestion": "Keep manual",
    "defect.descriptionEyebrow": "Description",
    "defect.descriptionTitle": "Review and save",
    "defect.type": "Defect type",
    "defect.toReport": "To report",
    "defect.save": "Save defect",
    "report.eyebrow": "Result",
    "report.title": "Report",
    "report.reanalyseModel": "Analysis model",
    "report.newDefect": "New defect",
    "report.generate": "Generate report",
    "report.defectsTitle": "Saved defects",
    "report.generatedTitle": "Reports",
    "common.back": "Back",
    "common.comment": "Comment",
    "common.commentPlaceholder": "Short structured description",
    "common.location": "Area",
    "common.locationPlaceholder": "For example: outer corner of stair flight, underside",
    "step.project.kicker": "Step 1 · Project",
    "step.project.title": "Project selection",
    "step.project.copy": "Choose a project or create a new one.",
    "step.session.kicker": "Step 2 · Session",
    "step.session.title": "Working session",
    "step.session.copy": "Open a session or continue it.",
    "step.defect.kicker": "Step 3 · Defect",
    "step.defect.title": "Photo and type",
    "step.defect.copy": "Photo, AI suggestion, confirmation.",
    "step.report.kicker": "Step 4 · Report",
    "step.report.title": "Report",
    "step.report.copy": "Review defects and generate the report."
  }
}

const defectMetaTranslations = {
  crack: {
    label: "Crack",
    defaultComment:
      "A crack has been detected. Clarify the location, extent, and visible characteristics of the defect.",
    requiredPrompts: [
      "Specify where the defect is located.",
      "Describe the visible nature of the crack.",
      "Add approximate dimensions if available."
    ]
  },
  honeycombing: {
    label: "Honeycombing / porous concrete",
    defaultComment:
      "Honeycombing or porous concrete areas have been detected. Clarify the spread area and surface condition.",
    requiredPrompts: [
      "Specify the structural element.",
      "Describe the affected area or locality.",
      "Note visible delamination or voids if present."
    ]
  },
  spalling: {
    label: "Spalling / cover loss",
    defaultComment:
      "Spalling or cover layer damage has been detected. Clarify the damaged area and related signs.",
    requiredPrompts: [
      "Specify the defect location.",
      "Describe the nature of the damage.",
      "Note exposed reinforcement if visible."
    ]
  },
  corrosion: {
    label: "Corrosion / rust traces",
    defaultComment:
      "Signs of corrosion or rust have been recorded. Clarify the source, affected area, and surface condition.",
    requiredPrompts: [
      "Specify the structural element.",
      "Describe intensity and spread of traces.",
      "Add a link to possible moisture if obvious."
    ]
  },
  leakage: {
    label: "Leakage / moisture",
    defaultComment:
      "Signs of leakage or moisture have been detected. Clarify the location and visible moisture impact.",
    requiredPrompts: [
      "Specify location and direction of moisture traces.",
      "Describe the intensity of manifestation.",
      "Note secondary finish or structural damage if present."
    ]
  },
  geometry: {
    label: "Geometry / installation deviation",
    defaultComment:
      "A visible geometry or installation deviation has been recorded. Clarify the element and the nature of the deviation.",
    requiredPrompts: [
      "Specify the structural element.",
      "Describe how the deviation appears.",
      "Add an approximate deviation value if possible."
    ]
  },
  unfinished: {
    label: "Incomplete / poor-quality works",
    defaultComment:
      "Incomplete or poor-quality works have been identified. Clarify the work scope and current condition.",
    requiredPrompts: [
      "Specify the work type.",
      "Describe what is missing or poorly executed.",
      "Add context for the area or room."
    ]
  },
  other: {
    label: "Other defect",
    defaultComment:
      "A defect requiring textual clarification of type, location, and signs has been detected.",
    requiredPrompts: [
      "Describe the defect in your own words.",
      "Specify where it was found.",
      "Record important visual details."
    ]
  }
}

const demoScenarioTranslations = {
  "crack-demo-1": {
    title: "Thin crack",
    description: "A clean example to demonstrate the SAM 2 contour mask."
  },
  "crack-demo-2": {
    title: "Local crack",
    description: "A compact example with a small defect zone."
  },
  "crack-demo-3": {
    title: "High-contrast crack",
    description: "A public demo case for a quick visual review."
  }
}

const stepMeta = {
  project: { index: 1 },
  session: { index: 2 },
  defect: { index: 3 },
  report: { index: 4 }
}

const elements = {
  statusBanner: document.querySelector("#status-banner"),
  stepKicker: document.querySelector("#step-kicker"),
  stepTitle: document.querySelector("#step-title"),
  stepCopy: document.querySelector("#step-copy"),
  stepNavItems: Array.from(document.querySelectorAll("[data-step-nav]")),
  screens: {
    project: document.querySelector("#screen-project"),
    session: document.querySelector("#screen-session"),
    defect: document.querySelector("#screen-defect"),
    report: document.querySelector("#screen-report")
  },
  projectForm: document.querySelector("#project-form"),
  projectChoice: document.querySelector("#project-choice"),
  projectQuickSummary: document.querySelector("#project-quick-summary"),
  projectContinueButton: document.querySelector("#project-continue-button"),
  sessionForm: document.querySelector("#session-form"),
  sessionInspectorInput: document.querySelector("#session-inspector-input"),
  sessionNoteInput: document.querySelector("#session-note-input"),
  sessionBackButton: document.querySelector("#session-back-button"),
  sessionSubmitButton: document.querySelector("#session-submit-button"),
  activeSessionCard: document.querySelector("#active-session-card"),
  activeSessionActions: document.querySelector("#active-session-actions"),
  continueSessionButton: document.querySelector("#continue-session-button"),
  defectForm: document.querySelector("#defect-form"),
  defectTypeSelect: document.querySelector("#defect-type-select"),
  commentInput: document.querySelector("#comment-input"),
  photoInput: document.querySelector("#photo-input"),
  photoTriggerButton: document.querySelector("#photo-trigger-button"),
  photoFileName: document.querySelector("#photo-file-name"),
  demoPanel: document.querySelector("#demo-panel"),
  demoScenarios: document.querySelector("#demo-scenarios"),
  demoSavePanel: document.querySelector("#demo-save-panel"),
  demoSaveCopy: document.querySelector("#demo-save-copy"),
  demoSaveName: document.querySelector("#demo-save-name"),
  demoSaveButton: document.querySelector("#demo-save-button"),
  demoDismissButton: document.querySelector("#demo-dismiss-button"),
  defectModelSelect: document.querySelector("#defect-model-select"),
  defectModelNote: document.querySelector("#defect-model-note"),
  defectLocationInput: document.querySelector('[name="locationDescription"]'),
  photoPreview: document.querySelector("#photo-preview"),
  suggestionPanel: document.querySelector("#suggestion-panel"),
  suggestionContent: document.querySelector("#suggestion-content"),
  acceptSuggestionButton: document.querySelector("#accept-suggestion-button"),
  dismissSuggestionButton: document.querySelector("#dismiss-suggestion-button"),
  defectHints: document.querySelector("#defect-hints"),
  defectSessionInline: document.querySelector("#defect-session-inline"),
  defectBackButton: document.querySelector("#defect-back-button"),
  jumpToReportButton: document.querySelector("#jump-to-report-button"),
  reportStepSummary: document.querySelector("#report-step-summary"),
  reportModelSelect: document.querySelector("#report-model-select"),
  reportModelNote: document.querySelector("#report-model-note"),
  defectCount: document.querySelector("#defect-count"),
  defectList: document.querySelector("#defect-list"),
  reportList: document.querySelector("#report-list"),
  newDefectButton: document.querySelector("#new-defect-button"),
  generateReportButton: document.querySelector("#generate-report-button")
}

elements.localeButtons = Array.from(document.querySelectorAll("[data-locale-switch]"))
let statusTimerId = 0

function t(key, vars = {}) {
  const template =
    translations[state.locale]?.[key] ??
    translations.ru[key] ??
    key

  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  )
}

function setLocale(locale) {
  state.locale = locale === "en" ? "en" : "ru"
  localStorage.setItem("constructai.locale", state.locale)

  const activeScenario = getDemoScenario(state.activeDemoScenarioId)
  if (
    activeScenario &&
    elements.commentInput?.dataset.demoScenarioId === activeScenario.id
  ) {
    const localizedScenario = getLocalizedDemoScenario(activeScenario)
    const defectType =
      activeScenario.suggestion?.finalType ||
      activeScenario.suggestion?.suggestedType ||
      "other"
    elements.commentInput.value =
      localizedScenario.comment || getDefectMeta(defectType).defaultComment
  }

  renderAll()
}

function getLocalizedTypeLabel(defectType, fallback = "") {
  return getDefectMeta(defectType)?.label || fallback || ""
}

function getStepMeta(step) {
  return {
    index: stepMeta[step].index,
    kicker: t(`step.${step}.kicker`),
    title: t(`step.${step}.title`),
    copy: t(`step.${step}.copy`)
  }
}

function applyLocaleToStaticUi() {
  document.documentElement.lang = state.locale === "en" ? "en" : "ru"
  document.title = t("document.title")

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n)
  })

  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.placeholder = t(node.dataset.i18nPlaceholder)
  })

  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel))
  })

  elements.localeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.localeSwitch === state.locale)
  })
}

function renderPhotoSourceLabel() {
  if (!elements.photoFileName) {
    return
  }

  const selectedFile = elements.photoInput?.files?.[0]

  if (selectedFile) {
    elements.photoFileName.textContent = selectedFile.name
    return
  }

  if (state.activeDemoScenarioId) {
    const scenario = getDemoScenario(state.activeDemoScenarioId)
    const localized = scenario ? getLocalizedDemoScenario(scenario) : null
    elements.photoFileName.textContent = localized
      ? `${state.locale === "en" ? "Demo" : "Демо"}: ${localized.title}`
      : t("defect.noPhotoSelected")
    return
  }

  elements.photoFileName.textContent = t("defect.noPhotoSelected")
}

function getDefaultDemoTitle() {
  const typeLabel = getLocalizedTypeLabel(
    elements.defectTypeSelect?.value || state.pendingSuggestion?.suggestedType || "crack",
    state.locale === "en" ? "Demo" : "Демо"
  )

  return state.locale === "en" ? `${typeLabel} example` : `${typeLabel} · demo`
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDate(value) {
  return new Intl.DateTimeFormat(state.locale === "en" ? "en-US" : "ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

function formatConfidence(value) {
  return getModelScoreText(value, state.locale)
}

function clampUnit(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.max(0, Math.min(1, numeric))
}

function toViewBoxPoint(value, max = 100) {
  return Number((clampUnit(value) * max).toFixed(2))
}

function clampRange(start, size) {
  const normalizedStart = clampUnit(start)
  const normalizedSize = Math.max(0, Number(size) || 0)
  const end = Math.max(normalizedStart, Math.min(1, normalizedStart + normalizedSize))

  return {
    start: normalizedStart,
    size: end - normalizedStart
  }
}

function normalizeBoxForDisplay(rawBox) {
  const padding = 0.01
  const minVisibleSide = 0.035
  const horizontal = clampRange(rawBox.x - padding, rawBox.width + padding * 2)
  const vertical = clampRange(rawBox.y - padding, rawBox.height + padding * 2)
  let width = horizontal.size
  let height = vertical.size
  let x = horizontal.start
  let y = vertical.start

  if (width < 0.012 && height < 0.012) {
    return null
  }

  if (width < minVisibleSide) {
    const centerX = x + width / 2
    width = minVisibleSide
    x = Math.max(0, Math.min(1 - width, centerX - width / 2))
  }

  if (height < minVisibleSide) {
    const centerY = y + height / 2
    height = minVisibleSide
    y = Math.max(0, Math.min(1 - height, centerY - height / 2))
  }

  return {
    x,
    y,
    width,
    height,
    label: typeof rawBox.label === "string" ? rawBox.label.trim() : "",
    confidence: Number.isFinite(Number(rawBox.confidence))
      ? Math.max(0, Math.min(1, Number(rawBox.confidence)))
      : 0
  }
}

function getOverlayRegionLabel(regionLabel, fallbackLabel = "") {
  return localizeRegionLabel(regionLabel, fallbackLabel, state.locale)
}

function getOverlaySize(visualEvidence) {
  const width = Number(visualEvidence?.maskWidth)
  const height = Number(visualEvidence?.maskHeight)

  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return {
      width,
      height,
      preserveAspectRatio: "xMidYMid slice"
    }
  }

  return {
    width: 100,
    height: 100,
    preserveAspectRatio: "none"
  }
}

function getVisualRegionCount(visualEvidence) {
  return Array.isArray(visualEvidence?.regions) ? visualEvidence.regions.length : 0
}

function formatRegionCount(count) {
  const numeric = Math.max(0, Number(count) || 0)

  if (state.locale === "en") {
    return `${numeric} ${numeric === 1 ? "zone" : "zones"}`
  }

  const mod10 = numeric % 10
  const mod100 = numeric % 100

  if (mod10 === 1 && mod100 !== 11) {
    return `${numeric} зона`
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${numeric} зоны`
  }

  return `${numeric} зон`
}

function getCurrentProject() {
  if (state.currentSessionBundle?.project) {
    return state.currentSessionBundle.project
  }

  return state.projects.find((project) => project.id === state.selectedProjectId) || null
}

function getDefectMeta(defectType) {
  const base =
    state.defectCatalog.find((item) => item.id === defectType) ||
    state.defectCatalog.find((item) => item.id === "other")

  if (!base || state.locale !== "en") {
    return base
  }

  const localized = defectMetaTranslations[base.id]

  return localized
    ? {
        ...base,
        label: localized.label,
        defaultComment: localized.defaultComment,
        requiredPrompts: localized.requiredPrompts
      }
    : base
}

function getSelectedCvModel() {
  return (
    state.cvModels.find((item) => item.key === state.selectedCvModelKey) ||
    state.cvModels[0] ||
    null
  )
}

function getDemoScenario(scenarioId) {
  return state.demoScenarios.find((item) => item.id === scenarioId) || null
}

function getLocalizedDemoScenario(scenario) {
  if (state.locale !== "en") {
    return scenario
  }

  const localized = demoScenarioTranslations[scenario.id] || {}
  const defectType =
    scenario.suggestion?.finalType || scenario.suggestion?.suggestedType || "other"
  const defectMeta = defectMetaTranslations[defectType] || defectMetaTranslations.other
  const modelLabel = scenario.suggestion?.modelLabel || "AI"

  return {
    ...scenario,
    title:
      scenario.titleEn || localized.title || `${defectMeta.label} example`,
    description:
      scenario.descriptionEn ||
      localized.description ||
      `Saved from local ${modelLabel} analysis.`,
    locationDescription: scenario.locationDescriptionEn || "",
    comment: scenario.commentEn || defectMeta.defaultComment
  }
}

function normalizeDemoScenarios(payload) {
  const scenarios = Array.isArray(payload?.scenarios) ? payload.scenarios : []

  return scenarios
    .filter(
      (item) =>
        typeof item?.id === "string" &&
        typeof item?.title === "string" &&
        typeof item?.imageUrl === "string" &&
        item?.suggestion?.visualEvidence
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      titleEn: typeof item.titleEn === "string" ? item.titleEn : "",
      description: typeof item.description === "string" ? item.description : "",
      descriptionEn:
        typeof item.descriptionEn === "string" ? item.descriptionEn : "",
      imageUrl: item.imageUrl,
      locationDescription:
        typeof item.locationDescription === "string" ? item.locationDescription : "",
      locationDescriptionEn:
        typeof item.locationDescriptionEn === "string" ? item.locationDescriptionEn : "",
      comment: typeof item.comment === "string" ? item.comment : "",
      commentEn: typeof item.commentEn === "string" ? item.commentEn : "",
      suggestion: item.suggestion
    }))
}

function getCvModelLabel(modelKey) {
  const model = state.cvModels.find((item) => item.key === modelKey)
  return model?.label || (state.locale === "en" ? "Unknown model" : "Неизвестная модель")
}

function localizeRuntimeText(message) {
  if (typeof message !== "string") {
    return message
  }
  if (state.locale !== "en") {
    return new Map([
      ["Invalid AI review decision.", "Некорректное решение по AI-подсказке."],
      ["Accepting AI requires the suggested defect type.", "Для принятия AI выберите предложенный тип дефекта."],
      ["There is no AI suggestion to review.", "Нет AI-подсказки для проверки."],
      ["AI suggestion changed. Reload before reviewing it.", "AI-подсказка изменилась. Обновите запись перед проверкой."],
      ["The defect changed. Reload before saving it.", "Дефект изменился. Обновите запись перед сохранением."],
      ["The defect changed during analysis. Reload and analyze again.", "Дефект изменился во время анализа. Обновите запись и повторите анализ."],
      ["Live AI analysis is disabled. Use a precomputed demo or manual entry.", "AI-анализ отключён. Выберите сохранённое демо или ручной ввод."],
      ["Live analysis is unavailable. Use a precomputed demo or manual entry.", "AI-анализ недоступен. Выберите сохранённое демо или ручной ввод."],
      ["SAM 3 returned a provisional crack mask.", "SAM 3 построил предварительную маску трещины."],
      ["SAM 3 returned no crack mask above the configured thresholds.", "SAM 3 не вернул маску трещины выше заданных порогов."]
    ]).get(message) || message
  }

  const reportMatch = /^Акт v(\d+) сформирован\.$/.exec(message)

  if (reportMatch) {
    return `Report v${reportMatch[1]} has been generated.`
  }

  const modelMatch = /^Основной стала модель (.+)\.$/.exec(message)

  if (modelMatch) {
    return `Primary model switched to ${modelMatch[1]}.`
  }

  const reanalyseMatch = /^Переанализ выполнен моделью (.+)\.$/.exec(message)

  if (reanalyseMatch) {
    return `Reanalysis completed with ${reanalyseMatch[1]}.`
  }

  const requiredFieldMatch = /^Поле "(.+)" обязательно\.$/.exec(message)

  if (requiredFieldMatch) {
    return `Field "${requiredFieldMatch[1]}" is required.`
  }

  const inferenceErrorMatch = /^CV inference service вернул ошибку (\d+)\.$/.exec(message)

  if (inferenceErrorMatch) {
    return `CV inference service returned error ${inferenceErrorMatch[1]}.`
  }
  const timeoutMatch = /^CV inference превысил лимит (\d+) мс\.$/.exec(message)
  if (timeoutMatch) return `CV inference exceeded the ${timeoutMatch[1]} ms deadline.`

  const modelNotConfiguredMatch = /^Модель (.+) ещё не подключена\.(.+)$/u.exec(message)

  if (modelNotConfiguredMatch) {
    return `Model ${modelNotConfiguredMatch[1]} is not connected yet.${modelNotConfiguredMatch[2]
      .replace(" Добавьте её endpoint или выберите другую модель.", " Add its endpoint or choose another model.")
      .replace(" Добавьте ее endpoint или выберите другую модель.", " Add its endpoint or choose another model.")}`
  }

  const directMap = new Map([
    ["Объект создан.", "Project has been created."],
    ["Сессия открыта.", "Session has been opened."],
    ["Тип из AI-подсказки применён.", "Type from AI suggestion has been applied."],
    ["Оставлен ручной выбор.", "Manual selection kept."],
    ["Сначала выберите объект.", "Select a project first."],
    ["Сначала откройте сессию.", "Open a session first."],
    ["Нужно добавить фото дефекта.", "Add a defect photo first."],
    ["Дефект сохранён.", "Defect has been saved."],
    ["Дефект обновлён.", "Defect has been updated."],
    ["Дефект удалён.", "Defect has been deleted."],
    ["Не удалось прочитать файл изображения.", "Failed to read the image file."],
    ["Не удалось загрузить демо-фото.", "Failed to load the demo photo."],
    ["Демо-сценарий не найден.", "Demo scenario not found."],
    ["Demo-библиотека доступна только для чтения.", "The demo library is read-only."],
    ["Не указан demo-сценарий для удаления.", "No demo scenario was specified for deletion."],
    ["У demo-сценария некорректный путь к изображению.", "The demo scenario image path is invalid."],
    ["Нельзя сохранить demo без изображения.", "Cannot save a demo without an image."],
    ["Нельзя сохранить demo без AI-результата.", "Cannot save a demo without an AI result."],
    ["Для demo нужен визуальный результат модели.", "A visual model result is required for a demo."],
    ["Demo-сценарий сохранён.", "Demo scenario has been saved."],
    ["Demo-сценарий удалён.", "Demo scenario has been deleted."],
    ["Сохранение demo отменено для текущего фото.", "Demo save skipped for the current photo."],
    ["Сессия не найдена.", "Session not found."],
    ["Сессия для дефекта не найдена.", "Session for this defect was not found."],
    ["Дефект не найден.", "Defect not found."],
    ["Нет выбранной модели для переанализа.", "No model selected for reanalysis."],
    ["Ни одна подключённая модель не вернула пригодный результат.", "No connected model returned a usable result."],
    ["Внутренняя ошибка сервера.", "Internal server error."],
    ["Размер запроса превышает допустимый лимит.", "Request size exceeds the allowed limit."],
    ["Тело запроса должно быть валидным JSON.", "Request body must be valid JSON."],
    ["API endpoint не найден.", "API endpoint was not found."],
    ["Выбранный проект не найден.", "Selected project was not found."],
    ["Проект сессии не найден.", "Session project was not found."],
    ["Нужно приложить хотя бы одну фотографию дефекта.", "At least one defect photo is required."],
    ["У дефекта нет сохранённой фотографии для переанализа.", "This defect has no saved photo for reanalysis."],
    ["Нельзя сформировать акт без зафиксированных дефектов.", "A report cannot be generated without saved defects."],
    ["Изображение дефекта не найдено.", "Defect image was not found."],
    ["Сформированный акт не найден.", "Generated report was not found."],
    ["HTML-документ акта недоступен.", "The report HTML document is unavailable."],
    ["Ожидается изображение в формате data URL.", "An image in data URL format is expected."],
    ["Формат изображения не поддерживается.", "This image format is not supported."],
    ["Изображение не содержит данных.", "The image contains no data."],
    ["Для AI-подсказки требуется изображение.", "An image is required for AI analysis."],
    ["CV inference service вернул некорректный ответ.", "CV inference service returned an invalid response."],
    ["CV inference service вернул невалидный JSON.", "CV inference service returned invalid JSON."],
    ["CV inference service недоступен.", "CV inference service is unavailable."],
    ["Очередь CV inference заполнена. Дождитесь завершения текущего анализа.", "The inference queue is full. Wait for the current analysis to finish."],
    ["CV inference service недоступен. Запустите CV-service или переключите режим AI.", "CV inference service is unavailable. Start the CV service or switch the AI mode."],
    ["Нет подключённых AI-моделей для сравнения. Подключите хотя бы один endpoint.", "No connected AI models are available for comparison. Connect at least one endpoint."],
    ["Ни одна AI-модель не смогла обработать изображение.", "No AI model was able to process the image."],
    ["Неизвестная ошибка AI.", "Unknown AI error."],
    ["Локально", "Local"],
    ["Локальный CV-service", "Local CV service"],
    ["Endpoint подключён", "Endpoint connected"],
    ["Endpoint не подключён", "Endpoint not connected"],
    ["Сегментация трещин в бетоне.", "Crack segmentation for concrete."],
    ["Zero-shot detector визуальных зон.", "Zero-shot detector for visual regions."],
    ["Сегментация трещин по текстовому запросу.", "Text-prompted crack segmentation."],
    ["Модель общего visual reasoning.", "General visual reasoning model."],
    ["Контракт для внешней CV-модели.", "Contract for an external CV model."]
  ])

  return directMap.get(message) || message
}

function normalizeRegionPoints(points) {
  return Array.isArray(points)
    ? points
        .filter(
          (point) =>
            Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y))
        )
        .map((point) => ({
          x: clampUnit(point.x),
          y: clampUnit(point.y)
        }))
    : []
}

function getRegionBounds(region) {
  if (region.kind === "box") {
    return {
      x: region.x,
      y: region.y,
      width: region.width,
      height: region.height
    }
  }

  const points = normalizeRegionPoints(region.points)

  if (points.length === 0) {
    return null
  }

  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)

  return normalizeBoxForDisplay({
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(0.04, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(0.04, Math.max(...ys) - Math.min(...ys)),
    label: region.label,
    confidence: region.confidence
  })
}

function getRenderableRegions(visualEvidence) {
  if (!Array.isArray(visualEvidence?.regions)) {
    return []
  }

  return visualEvidence.regions
    .map((region) => {
      if (region.kind === "box") {
        const bounds = normalizeBoxForDisplay({
          x: clampUnit(region.x),
          y: clampUnit(region.y),
          width: clampUnit(region.width),
          height: clampUnit(region.height),
          label: region.label,
          confidence: region.confidence
        })

        if (!bounds) {
          return null
        }

        return {
          kind: "box",
          label: bounds.label,
          confidence: bounds.confidence,
          bounds,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        }
      }

      const points = normalizeRegionPoints(region.points)

      if (points.length < (region.kind === "polygon" ? 3 : 2)) {
        return null
      }

      const bounds = getRegionBounds({
        kind: region.kind,
        points,
        label: region.label,
        confidence: region.confidence
      })

      if (!bounds) {
        return null
      }

      return {
        kind: region.kind === "polygon" ? "polygon" : "polyline",
        label: region.label,
        confidence: Number.isFinite(Number(region.confidence))
          ? Math.max(0, Math.min(1, Number(region.confidence)))
          : 0,
        points,
        bounds
      }
    })
    .filter(Boolean)
}

function getDisplayVisualEvidence(visualEvidence, fallbackLabel = "") {
  if (!visualEvidence) {
    return null
  }

  const regions = getRenderableRegions(visualEvidence)

  if (regions.length === 0) {
    return null
  }

  return {
    ...visualEvidence,
    renderMode:
      typeof visualEvidence.renderMode === "string" && visualEvidence.renderMode.trim() !== ""
        ? visualEvidence.renderMode.trim()
        : "",
    regions: regions.map((region, index) => ({
      id: `region-${index + 1}`,
      kind: region.kind,
      label: getOverlayRegionLabel(region.label, fallbackLabel),
      confidence: region.confidence,
      ...(region.kind === "box"
        ? {
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height
          }
        : {
            points: region.points
          })
    }))
  }
}

function renderVisualEvidence(visualEvidence, overlayLabel = "") {
  const displayEvidence = getDisplayVisualEvidence(visualEvidence, overlayLabel)

  if (!displayEvidence) {
    return ""
  }

  const overlaySize = getOverlaySize(displayEvidence)
  const regions = getRenderableRegions(displayEvidence)
  const renderMode = displayEvidence.renderMode === "mask" ? "mask" : "vector"

  if (regions.length === 0) {
    return ""
  }

  const maskMarkup =
    renderMode === "mask" && typeof displayEvidence.maskDataUrl === "string"
      ? `<image class="detection-overlay__mask" href="${escapeHtml(displayEvidence.maskDataUrl)}" x="0" y="0" width="${overlaySize.width}" height="${overlaySize.height}" preserveAspectRatio="${overlaySize.preserveAspectRatio}" />`
      : ""

  const markup = regions
    .map((region, index) => {
      const regionLabel = getOverlayRegionLabel(region.label, overlayLabel)
      const bounds = region.bounds || getRegionBounds(region)

      if (!bounds) {
        return ""
      }

      const labelWidth = Math.max(44, Math.round(regionLabel.length * 6.4))
      const labelX = Math.max(8, toViewBoxPoint(bounds.x, overlaySize.width) + 6)
      const labelY = Math.max(8, toViewBoxPoint(bounds.y, overlaySize.height) + 6)
      const labelMarkup = regionLabel && renderMode !== "mask"
        ? `
          <g class="detection-overlay__region-label">
            <rect
              class="detection-overlay__region-label-bg"
              x="${labelX}"
              y="${labelY}"
              width="${labelWidth}"
              height="16"
              rx="8"
              ry="8"
            />
            <text class="detection-overlay__region-label-text" x="${labelX + 7}" y="${labelY + 11}">
              ${escapeHtml(regionLabel)}
            </text>
          </g>
        `
        : ""

      let shapeMarkup = ""
      const regionStyle = `style="--region-order:${index};"`

      if (region.kind === "box") {
        const x = toViewBoxPoint(region.x, overlaySize.width)
        const y = toViewBoxPoint(region.y, overlaySize.height)
        const width = toViewBoxPoint(region.width, overlaySize.width)
        const height = toViewBoxPoint(region.height, overlaySize.height)

        shapeMarkup =
          renderMode === "mask"
            ? ""
            : `<rect class="detection-overlay__box" ${regionStyle} x="${x}" y="${y}" width="${width}" height="${height}" rx="4" ry="4" />`
      } else if (region.kind === "polygon") {
        const points = region.points
          .map(
            (point) =>
              `${toViewBoxPoint(point.x, overlaySize.width)},${toViewBoxPoint(point.y, overlaySize.height)}`
          )
          .join(" ")

        shapeMarkup = `<polygon class="detection-overlay__trace detection-overlay__trace--polygon" ${regionStyle} pathLength="100" points="${points}" />`
      } else {
        const points = region.points
          .map(
            (point) =>
              `${toViewBoxPoint(point.x, overlaySize.width)},${toViewBoxPoint(point.y, overlaySize.height)}`
          )
          .join(" ")

        shapeMarkup = `<polyline class="detection-overlay__trace" ${regionStyle} pathLength="100" points="${points}" />`
      }

      return `
        <g class="detection-overlay__region" ${regionStyle}>
          ${shapeMarkup}
          ${labelMarkup}
        </g>
      `
    })
    .join("")

  return `
    <svg class="detection-overlay detection-overlay--${renderMode}" viewBox="0 0 ${overlaySize.width} ${overlaySize.height}" preserveAspectRatio="${overlaySize.preserveAspectRatio}" aria-hidden="true">
      ${maskMarkup}
      ${markup}
    </svg>
  `
}

function renderPhotoFigure({
  imageUrl,
  altText,
  visualEvidence = null,
  overlayLabel = "",
  metaText = "",
  badgeText = "",
  footerText = "",
  figureClass = ""
}) {
  const overlay = renderVisualEvidence(visualEvidence, overlayLabel)

  return `
    <div class="inspection-photo ${escapeHtml(figureClass).trim()}">
      <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(altText)}" />
      ${overlay}
      ${
        metaText
          ? `<span class="inspection-photo__meta">${escapeHtml(metaText)}</span>`
          : ""
      }
      ${
        badgeText
          ? `<span class="inspection-photo__badge">${escapeHtml(badgeText)}</span>`
          : ""
      }
      ${
        footerText
          ? `<div class="inspection-photo__footer">${escapeHtml(footerText)}</div>`
          : ""
      }
    </div>
  `
}

function getSuggestionDecisionLabel(suggestion) {
  return getReviewLabel(suggestion, state.locale)
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "content-type": "application/json"
    },
    ...options
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      localizeRuntimeText(
        data.error || (state.locale === "en" ? "Request failed." : "Запрос завершился ошибкой.")
      )
    )
  }

  return data
}

function showStatus(message, kind = "success") {
  if (statusTimerId) {
    window.clearTimeout(statusTimerId)
    statusTimerId = 0
  }

  elements.statusBanner.textContent = localizeRuntimeText(message)
  elements.statusBanner.className = `status-banner status-banner--${kind}`

  const durationByKind = {
    success: 2600,
    error: 5200
  }
  const duration = durationByKind[kind] || 3200

  statusTimerId = window.setTimeout(() => {
    clearStatus()
  }, duration)
}

function clearStatus() {
  if (statusTimerId) {
    window.clearTimeout(statusTimerId)
    statusTimerId = 0
  }

  elements.statusBanner.textContent = ""
  elements.statusBanner.className = "status-banner hidden"
}

function resetDemoSaveState() {
  state.demoSaveState = "idle"

  if (elements.demoSaveName) {
    elements.demoSaveName.value = ""
  }
}

function resetSuggestionState() {
  state.suggestionRequestId += 1
  state.aiDecision = "pending_review"
  state.pendingSuggestion = null
  state.comparisonResults = []
  state.suggestionStatus = "idle"
  state.suggestionError = ""
  resetDemoSaveState()
}

function ensureUiStep() {
  if (!state.selectedProjectId && !state.currentSessionBundle) {
    state.uiStep = "project"
    return
  }

  if (!state.currentSessionBundle && (state.uiStep === "defect" || state.uiStep === "report")) {
    state.uiStep = "session"
  }

  if (state.currentSessionBundle && state.uiStep === "session") {
    return
  }
}

function setStep(step) {
  state.uiStep = step
  ensureUiStep()
  renderAll()
}

function isStepAvailable(step) {
  if (step === "project") {
    return true
  }

  if (step === "session") {
    return Boolean(getCurrentProject())
  }

  return Boolean(state.currentSessionBundle)
}

function renderProjectOptions() {
  const currentProject = getCurrentProject()
  const selectedId = currentProject?.id || state.selectedProjectId

  elements.projectChoice.innerHTML = [
    `<option value="">${escapeHtml(state.locale === "en" ? "Select project" : "Выберите объект")}</option>`,
    ...state.projects.map(
      (project) =>
        `<option value="${project.id}">${escapeHtml(project.name)}</option>`
    )
  ].join("")

  if (selectedId) {
    elements.projectChoice.value = selectedId
  }
}

function renderProjectSummary() {
  const project = getCurrentProject()

  if (!project) {
    elements.projectQuickSummary.classList.add("hidden")
    elements.projectQuickSummary.innerHTML = ""
    elements.projectContinueButton.disabled = true
    return
  }

  elements.projectQuickSummary.classList.remove("hidden")
  elements.projectQuickSummary.innerHTML = `
    <div class="project-summary">
      <div class="project-summary__title">
        <strong>${escapeHtml(project.name)}</strong>
        <p class="project-summary__line">${escapeHtml(
          project.address || (state.locale === "en" ? "Address not specified" : "Адрес не указан")
        )}</p>
      </div>
      <p class="project-summary__line project-summary__line--muted">${escapeHtml(
        project.description || (state.locale === "en" ? "No short description added" : "Краткое описание не добавлено")
      )}</p>
    </div>
  `
  elements.projectContinueButton.disabled = false
}

function renderDefectTypeOptions() {
  const selectedValue = elements.defectTypeSelect.value || "crack"
  elements.defectTypeSelect.innerHTML = state.defectCatalog
    .map(
      (item) => `<option value="${item.id}">${escapeHtml(getDefectMeta(item.id).label)}</option>`
    )
    .join("")

  if (state.defectCatalog.some((item) => item.id === selectedValue)) {
    elements.defectTypeSelect.value = selectedValue
  }

  updateDefectHints()
}

function renderCvModelOptions() {
  const selectedKey = getSelectedCvModel()?.key || state.selectedCvModelKey
  const optionsMarkup = state.cvModels
    .map(
      (item) =>
        `<option value="${item.key}">${escapeHtml(item.label)}${
          item.configured ? "" : state.locale === "en" ? " · not configured" : " · не подключена"
        }</option>`
    )
    .join("")

  elements.defectModelSelect.innerHTML = optionsMarkup
  elements.reportModelSelect.innerHTML = optionsMarkup

  if (selectedKey) {
    elements.defectModelSelect.value = selectedKey
    elements.reportModelSelect.value = selectedKey
  }
}

function renderCvModelNotes() {
  const model = getSelectedCvModel()

  if (!model) {
    elements.defectModelNote.textContent =
      state.locale === "en" ? "Models are not available yet." : "Модели пока недоступны."
    elements.reportModelNote.textContent =
      state.locale === "en" ? "Models are not available yet." : "Модели пока недоступны."
    return
  }

  const note = `${localizeRuntimeText(model.description)} ${localizeRuntimeText(model.statusLabel)}.`
  elements.defectModelNote.textContent = note
  elements.reportModelNote.textContent =
    `${note} ${state.locale === "en" ? "Used for saved defects." : "Для сохранённых дефектов."}`
}

function renderDemoScenarios() {
  if (!elements.demoPanel || !elements.demoScenarios) {
    return
  }

  if (state.demoScenarios.length === 0) {
    elements.demoPanel.classList.add("hidden")
    elements.demoScenarios.innerHTML = ""
    return
  }

  elements.demoPanel.classList.remove("hidden")
  elements.demoScenarios.innerHTML = state.demoScenarios
    .map((scenarioInput) => {
      const scenario = getLocalizedDemoScenario(scenarioInput)
      const isActive = scenario.id === state.activeDemoScenarioId
      const isDeleting = state.demoDeletingId === scenario.id

      return `
        <article class="demo-card ${isActive ? "demo-card--active" : ""}">
          <button
            class="demo-card__media"
            type="button"
            data-demo-scenario-id="${escapeHtml(scenario.id)}"
            aria-label="${escapeHtml(state.locale === "en" ? `Try demo: ${scenario.title}` : `Проверить демо: ${scenario.title}`)}"
          >
            <img src="${escapeHtml(scenario.imageUrl)}" alt="${escapeHtml(scenario.title)}" />
          </button>
          <div class="demo-card__body">
            <strong>${escapeHtml(scenario.title)}</strong>
            <p>${escapeHtml(scenario.description)}</p>
            <div class="demo-card__actions">
              <button
                class="button ${isActive ? "button--secondary" : ""}"
                type="button"
                data-demo-scenario-id="${escapeHtml(scenario.id)}"
                ${isDeleting ? "disabled" : ""}
              >
                ${isActive ? (state.locale === "en" ? "Shown" : "Показано") : (state.locale === "en" ? "Run demo" : "Проверить демо")}
              </button>
              ${
                state.demoLibraryWritable
                  ? `<button
                      class="button button--plain button--danger"
                      type="button"
                      data-demo-delete-id="${escapeHtml(scenario.id)}"
                      ${isDeleting ? "disabled" : ""}
                    >
                      ${escapeHtml(t("demo.deleteButton"))}
                    </button>`
                  : ""
              }
            </div>
          </div>
        </article>
      `
    })
    .join("")
}

function getSuccessfulComparisonResults() {
  return state.comparisonResults.filter(
    (item) => item?.ok && item.suggestion && typeof item.suggestion === "object"
  )
}

function getPrimarySuggestionFromResults() {
  const successful = getSuccessfulComparisonResults()
  const sam3 = successful.find(
    (item) => item.modelKey === "sam3" && hasMaskVisualEvidence(item.suggestion)
  )

  return (
    successful.find((item) => item.modelKey === state.selectedCvModelKey)?.suggestion ||
    sam3?.suggestion ||
    successful[0]?.suggestion ||
    null
  )
}

function hasMaskVisualEvidence(suggestion) {
  const visualEvidence = getDisplayVisualEvidence(
    suggestion?.visualEvidence,
    suggestion?.suggestedTypeLabel || ""
  )

  return (
    visualEvidence?.renderMode === "mask" &&
    typeof visualEvidence.maskDataUrl === "string" &&
    visualEvidence.maskDataUrl !== "" &&
    getVisualRegionCount(visualEvidence) > 0
  )
}

function getHeroPreviewSuggestion() {
  return getPrimarySuggestionFromResults() || state.pendingSuggestion
}

function renderComparisonCards() {
  const successful = getSuccessfulComparisonResults()

  if (successful.length <= 1) {
    return ""
  }

  return `
    <div class="comparison-grid">
      ${successful
        .map((item) => {
          const suggestion = item.suggestion
          const selected = suggestion.modelKey === state.pendingSuggestion?.modelKey
          const regionCount = getVisualRegionCount(
            getDisplayVisualEvidence(suggestion.visualEvidence)
          )

          return `
            <article class="comparison-card ${selected ? "comparison-card--selected" : ""}">
              ${renderPhotoFigure({
                imageUrl: state.pendingImageDataUrl,
                altText: state.locale === "en" ? `Comparison: ${item.modelLabel}` : `Сравнение: ${item.modelLabel}`,
                visualEvidence: suggestion.visualEvidence,
                overlayLabel: getLocalizedTypeLabel(
                  suggestion.suggestedType,
                  suggestion.suggestedTypeLabel || ""
                ),
                metaText: suggestion.modelLabel || item.modelLabel,
                badgeText: getDefectMeta(suggestion.suggestedType).label,
                footerText:
                  regionCount > 0
                    ? `${formatConfidence(suggestion.confidence)} · ${formatRegionCount(regionCount)}`
                    : `${formatConfidence(suggestion.confidence)} · ${state.locale === "en" ? "no zone" : "без зоны"}`
              })}
              <div class="comparison-card__body">
                <div class="subhead">
                  <h4>${escapeHtml(item.modelLabel)}</h4>
                  <span class="meta-note">${escapeHtml(
                    getDefectMeta(suggestion.suggestedType).label
                  )}</span>
                </div>
                <p class="inline-note">${escapeHtml(
                  regionCount > 0
                    ? `${formatConfidence(suggestion.confidence)} · ${formatRegionCount(regionCount)}`
                    : `${formatConfidence(suggestion.confidence)} · ${state.locale === "en" ? "no zone" : "без зоны"}`
                )}</p>
                <button
                  class="button ${selected ? "button--secondary" : ""}"
                  type="button"
                  data-compare-model-key="${item.modelKey}"
                >
                  ${selected ? (state.locale === "en" ? "Current primary" : "Текущая основная") : (state.locale === "en" ? "Make primary" : "Сделать основной")}
                </button>
              </div>
            </article>
          `
        })
        .join("")}
    </div>
  `
}

function updateDefectHints() {
  const meta = getDefectMeta(elements.defectTypeSelect.value)
  const isAutofilled = elements.commentInput.dataset.autofilled === "true"

  if (!elements.commentInput.value.trim() || isAutofilled) {
    elements.commentInput.value = meta.defaultComment
    elements.commentInput.dataset.autofilled = "true"
  }

  elements.defectHints.innerHTML = `
    <strong>${escapeHtml(meta.label)}</strong>
    <p>${escapeHtml(meta.requiredPrompts[0] || "")}</p>
  `

  renderSuggestionPanel()
}

function renderPhotoPreview() {
  if (!state.pendingImageDataUrl) {
    elements.photoPreview.innerHTML = t("defect.previewEmpty")
    elements.photoPreview.className = "photo-preview photo-preview--empty"
    elements.photoPreview.setAttribute("aria-busy", "false")
    return
  }

  const heroSuggestion =
    state.suggestionStatus === "ready" ? getHeroPreviewSuggestion() : null
  const visualEvidence =
    heroSuggestion
      ? getDisplayVisualEvidence(
          heroSuggestion.visualEvidence,
          heroSuggestion.suggestedTypeLabel || ""
        )
      : null
  const regionCount = getVisualRegionCount(visualEvidence)
  let badgeText = state.locale === "en" ? "Photo loaded" : "Фото загружено"
  let footerText = ""
  let figureClass = "inspection-photo--idle"
  const previewClasses = ["photo-preview", "photo-preview--active"]

  if (state.suggestionStatus === "loading") {
    badgeText = state.activeDemoScenarioId
      ? state.locale === "en" ? "Loading saved mask" : "Загрузка сохранённой маски"
      : state.locale === "en" ? "AI is analyzing" : "AI анализирует"
    if (!state.activeDemoScenarioId) {
      figureClass = "inspection-photo--analysis-pending"
      previewClasses.push("photo-preview--analyzing")
    }
  } else if (state.suggestionStatus === "error") {
    badgeText = state.locale === "en" ? "AI unavailable" : "AI недоступен"
  } else if (regionCount > 0) {
    figureClass = "inspection-photo--analysis-ready"
    previewClasses.push("photo-preview--revealed")

    badgeText =
      visualEvidence?.renderMode === "mask"
        ? state.locale === "en"
          ? `${formatRegionCount(regionCount)} highlighted`
          : `Выделено: ${formatRegionCount(regionCount)}`
        : state.locale === "en"
          ? `${formatRegionCount(regionCount)} detected`
          : `Зон: ${formatRegionCount(regionCount)}`
    footerText =
      visualEvidence?.renderMode === "mask"
        ? state.locale === "en"
          ? `${heroSuggestion?.modelLabel || "Model"} mask`
          : `Маска ${heroSuggestion?.modelLabel || "модели"}`
        : state.locale === "en"
          ? "Model attention zone"
          : "Зона внимания модели"
  } else if (state.suggestionStatus === "ready") {
    badgeText = state.locale === "en" ? "AI suggested a type" : "AI предложил тип"
  }

  elements.photoPreview.innerHTML = renderPhotoFigure({
    imageUrl: state.pendingImageDataUrl,
    altText: state.locale === "en" ? "Defect photo preview" : "Предпросмотр фото дефекта",
    visualEvidence,
    overlayLabel: getLocalizedTypeLabel(heroSuggestion?.suggestedType, heroSuggestion?.suggestedTypeLabel || ""),
    metaText: heroSuggestion?.modelLabel || "",
    badgeText,
    footerText,
    figureClass
  })
  elements.photoPreview.className = previewClasses.join(" ")
  elements.photoPreview.setAttribute(
    "aria-busy",
    state.suggestionStatus === "loading" ? "true" : "false"
  )
}

function setPhotoPreview(dataUrl = "") {
  state.pendingImageDataUrl = dataUrl
  renderPhotoSourceLabel()

  if (!dataUrl) {
    state.activeDemoScenarioId = ""
    resetSuggestionState()
    renderPhotoPreview()
    renderSuggestionPanel()
    return
  }

  renderPhotoPreview()
  renderSuggestionPanel()
}

function renderDemoSavePanel() {
  if (!elements.demoSavePanel || !elements.demoSaveName || !elements.demoSaveButton || !elements.demoDismissButton) {
    return
  }

  const shouldOfferSave =
    state.demoLibraryWritable &&
    state.suggestionStatus === "ready" &&
    Boolean(state.pendingSuggestion) &&
    Boolean(state.pendingImageDataUrl) &&
    !state.activeDemoScenarioId &&
    state.demoSaveState !== "dismissed" &&
    state.demoSaveState !== "saved"

  if (!shouldOfferSave) {
    elements.demoSavePanel.classList.add("hidden")
    return
  }

  elements.demoSavePanel.classList.remove("hidden")

  if (!elements.demoSaveName.value.trim()) {
    elements.demoSaveName.value = getDefaultDemoTitle()
  }

  const isSaving = state.demoSaveState === "saving"
  elements.demoSaveButton.disabled = isSaving
  elements.demoDismissButton.disabled = isSaving
}

function renderSuggestionPanel() {
  renderPhotoPreview()
  renderDemoSavePanel()
  const decision = state.pendingSuggestion ? state.aiDecision : "manual_entry"
  for (const [button, value] of [
    [elements.acceptSuggestionButton, "accepted"],
    [elements.dismissSuggestionButton, "manual"]
  ]) {
    button.setAttribute("aria-pressed", String(decision === value))
    button.classList.toggle("is-selected", decision === value)
  }

  if (!state.pendingImageDataUrl) {
    elements.suggestionPanel.classList.add("hidden")
    elements.suggestionContent.innerHTML = ""
    elements.demoSavePanel?.classList.add("hidden")
    return
  }

  elements.suggestionPanel.classList.remove("hidden")

  if (state.suggestionStatus === "loading") {
    elements.suggestionContent.innerHTML =
      `<p class="inline-note">${escapeHtml(state.activeDemoScenarioId
        ? state.locale === "en" ? "Loading the saved demo result." : "Загрузка сохранённого демо-результата."
        : state.locale === "en" ? "Analyzing with the selected model." : "Анализ выбранной моделью.")}</p>`
    elements.acceptSuggestionButton.disabled = true
    elements.dismissSuggestionButton.disabled = true
    renderDemoSavePanel()
    return
  }

  if (state.suggestionStatus === "error") {
    elements.suggestionContent.innerHTML = `
      <p class="inline-note">${escapeHtml(state.locale === "en" ? "AI suggestion is currently unavailable" : "AI-подсказка сейчас недоступна")}: ${escapeHtml(localizeRuntimeText(state.suggestionError))}</p>
      <p class="inline-note">${escapeHtml(state.locale === "en" ? "Continue manually." : "Продолжайте вручную.")}</p>
    `
    elements.acceptSuggestionButton.disabled = true
    elements.dismissSuggestionButton.disabled = false
    renderDemoSavePanel()
    return
  }

  if (state.suggestionStatus !== "ready" || !state.pendingSuggestion) {
    elements.suggestionContent.innerHTML =
      `<p class="inline-note">${escapeHtml(state.locale === "en" ? "The model suggestion will appear after a photo is selected." : "После выбора фото здесь появится подсказка модели.")}</p>`
    elements.acceptSuggestionButton.disabled = true
    elements.dismissSuggestionButton.disabled = true
    renderDemoSavePanel()
    return
  }

  const suggestion = state.pendingSuggestion
  const suggestedType = getDefectMeta(suggestion.suggestedType)
  const regionCount = getVisualRegionCount(
    getDisplayVisualEvidence(suggestion.visualEvidence)
  )
  const failedModels = state.comparisonResults.filter((item) => !item.ok)
  const comparisonCards = renderComparisonCards()
  const comparisonSummary =
    state.locale === "en"
      ? `Model comparison · ${getSuccessfulComparisonResults().length} active`
      : `Сравнение моделей · активных: ${getSuccessfulComparisonResults().length}`

  elements.suggestionContent.innerHTML = `
    <div class="tag-row">
      <span class="tag">${escapeHtml(suggestion.modelLabel || suggestion.sourceLabel)}</span>
      <span class="tag">${escapeHtml(getModelScoreText(suggestion.confidence, state.locale))}</span>
    </div>
    <p><strong>${escapeHtml(suggestedType.label)}</strong></p>
    <p class="inline-note">${escapeHtml(getAnalysisLabel(suggestion, state.locale))}</p>
    <p class="review-indicator" data-review-decision="${state.aiDecision}">${escapeHtml(getReviewLabel({ review: { version: 1, decision: state.aiDecision } }, state.locale))}</p>
    <p class="inline-note">${escapeHtml(state.locale === "en"
      ? "The score is an uncalibrated model output, not validated accuracy. Review records your type selection, not a structural safety assessment."
      : "Оценка модели не является проверенной точностью. Решение фиксирует выбор типа, а не оценку безопасности конструкции.")}</p>
    ${
      regionCount > 0
        ? `<p class="inline-note">${escapeHtml(state.locale === "en" ? `Highlighted ${formatRegionCount(regionCount)} on the main photo.` : `На главном фото выделено ${formatRegionCount(regionCount)}.`)}</p>`
        : `<p class="inline-note">${escapeHtml(state.locale === "en" ? "The model suggested a type without a visible zone." : "Модель предложила тип без видимой зоны.")}</p>`
    }
    ${
      comparisonCards
        ? `<details class="analysis-details">
            <summary>${escapeHtml(comparisonSummary)}</summary>
            ${comparisonCards}
            ${
              failedModels.length > 0
                ? `<p class="inline-note">${escapeHtml(state.locale === "en" ? "No response from" : "Без ответа")}: ${escapeHtml(
                    failedModels.map((item) => item.modelLabel).join(", ")
                  )}.</p>`
                : ""
            }
          </details>`
        : failedModels.length > 0
          ? `<p class="inline-note">${escapeHtml(state.locale === "en" ? "No response from" : "Без ответа")}: ${escapeHtml(
              failedModels.map((item) => item.modelLabel).join(", ")
            )}.</p>`
          : ""
    }
  `

  elements.acceptSuggestionButton.disabled = false
  elements.dismissSuggestionButton.disabled = false
  renderDemoSavePanel()
}

function renderActiveSession() {
  const bundle = state.currentSessionBundle
  const currentProject = getCurrentProject()
  const isSameProject = bundle && currentProject && bundle.project.id === currentProject.id

  if (!bundle || !isSameProject) {
    elements.activeSessionCard.classList.add("hidden")
    elements.activeSessionCard.innerHTML = ""
    elements.activeSessionActions.classList.add("hidden")
    elements.sessionForm.classList.remove("hidden")
    return
  }

  elements.activeSessionCard.classList.remove("hidden")
  elements.activeSessionActions.classList.remove("hidden")
  elements.sessionForm.classList.add("hidden")
  elements.activeSessionCard.innerHTML = `
    <div class="screen-card__header">
      <p class="screen-card__eyebrow">${escapeHtml(state.locale === "en" ? "Active session" : "Активная сессия")}</p>
      <h2>${escapeHtml(bundle.project.name)}</h2>
    </div>
    <div class="session-summary-grid">
      <div class="session-summary-item">
        <small>${escapeHtml(state.locale === "en" ? "Inspector" : "Инспектор")}</small>
        <strong>${escapeHtml(bundle.session.inspectorName || (state.locale === "en" ? "Not specified" : "Не указан"))}</strong>
      </div>
      <div class="session-summary-item">
        <small>${escapeHtml(state.locale === "en" ? "Defects" : "Дефекты")}</small>
        <strong>${bundle.defects.length}</strong>
      </div>
      <div class="session-summary-item">
        <small>${escapeHtml(state.locale === "en" ? "Opened" : "Открыта")}</small>
        <strong>${escapeHtml(formatDate(bundle.session.createdAt))}</strong>
      </div>
    </div>
  `
}

function renderDefectContext() {
  if (!state.currentSessionBundle) {
    elements.defectSessionInline.innerHTML = state.locale === "en" ? "Open a session first." : "Сначала откройте сессию."
    elements.jumpToReportButton.disabled = true
    return
  }

  elements.defectSessionInline.innerHTML = `
    <span>${escapeHtml(state.currentSessionBundle.project.name)}</span>
    <span>${state.currentSessionBundle.defects.length} ${escapeHtml(state.locale === "en" ? "defects in session" : "дефектов в сессии")}</span>
  `
  elements.jumpToReportButton.disabled = state.currentSessionBundle.defects.length === 0
}

function renderDefectTypeSelectOptions(selectedValue) {
  return state.defectCatalog
    .map(
      (item) =>
        `<option value="${item.id}" ${item.id === selectedValue ? "selected" : ""}>${escapeHtml(item.label)}</option>`
    )
    .join("")
}

function renderDefects() {
  const defects = state.currentSessionBundle?.defects || []
  elements.defectCount.innerHTML = `<span class="defect-count-pill">${escapeHtml(
    state.locale === "en" ? `${defects.length} saved` : `${defects.length} сохранено`
  )}</span>`

  if (!state.currentSessionBundle) {
    elements.defectList.className = "defect-list empty-state"
    elements.defectList.textContent = state.locale === "en" ? "Open a session first." : "Сначала откройте сессию."
    return
  }

  if (defects.length === 0) {
    elements.defectList.className = "defect-list empty-state"
    elements.defectList.textContent = state.locale === "en" ? "There are no defects in this session yet." : "В этой сессии пока нет дефектов."
    return
  }

  elements.defectList.className = "defect-list"
  elements.defectList.innerHTML = defects
    .slice()
    .reverse()
    .map((defect) => {
      const meta = getDefectMeta(defect.defectType)
      const photo = defect.photos[0]
      const visualEvidence = getDisplayVisualEvidence(
        defect.aiSuggestion?.visualEvidence,
        getLocalizedTypeLabel(defect.aiSuggestion?.suggestedType, defect.aiSuggestion?.suggestedTypeLabel) ||
          meta.label
      )
      const regionCount = getVisualRegionCount(visualEvidence)
      const isEditing = state.editingDefectId === defect.id

      return `
        <article class="defect-item">
          ${renderPhotoFigure({
            imageUrl: photo.publicPath,
            altText: meta.label,
            visualEvidence,
            overlayLabel:
              getLocalizedTypeLabel(defect.aiSuggestion?.suggestedType, defect.aiSuggestion?.suggestedTypeLabel) ||
              meta.label,
            metaText: defect.aiSuggestion?.modelLabel || "",
            badgeText: defect.aiSuggestion
              ? getSuggestionDecisionLabel(defect.aiSuggestion)
              : getReviewLabel(null, state.locale),
            footerText:
              regionCount > 0
                ? state.locale === "en"
                  ? `AI saved ${formatRegionCount(regionCount)}.`
                  : `AI сохранил ${formatRegionCount(regionCount)}.`
                : ""
          })}
          <div class="defect-item__body">
            <div class="subhead">
              <h4>${escapeHtml(meta.label)}</h4>
              <span class="meta-note">${escapeHtml(formatDate(defect.createdAt))}</span>
            </div>
            ${
              isEditing
                ? `
                  <form class="defect-edit-form" data-defect-id="${defect.id}">
                    <label>
                      <span>${escapeHtml(state.locale === "en" ? "Defect type" : "Тип дефекта")}</span>
                      <select name="defectType" required>${renderDefectTypeSelectOptions(defect.defectType)}</select>
                    </label>
                    <label>
                      <span>${escapeHtml(state.locale === "en" ? "Area" : "Участок")}</span>
                      <input
                        name="locationDescription"
                        type="text"
                        value="${escapeHtml(defect.locationDescription || "")}"
                        placeholder="${escapeHtml(state.locale === "en" ? "For example: outer corner of flight" : "Например: наружный угол марша")}"
                      />
                    </label>
                    <label>
                      <span>${escapeHtml(state.locale === "en" ? "Comment" : "Комментарий")}</span>
                      <textarea name="comment" rows="4" required>${escapeHtml(defect.comment)}</textarea>
                    </label>
                    <div class="action-row action-row--compact defect-item__actions">
                      <button class="button button--secondary" type="submit">${escapeHtml(state.locale === "en" ? "Save" : "Сохранить")}</button>
                      <button class="button button--plain" type="button" data-defect-action="cancel-edit" data-defect-id="${defect.id}">${escapeHtml(state.locale === "en" ? "Cancel" : "Отмена")}</button>
                    </div>
                  </form>
                `
                : `
                  <p class="defect-item__location">${escapeHtml(defect.locationDescription || (state.locale === "en" ? "Area not specified" : "Участок не указан"))}</p>
                  ${
                    defect.aiSuggestion
                      ? `<p class="inline-note">${escapeHtml(state.locale === "en" ? "AI suggested" : "AI предложил")}: ${escapeHtml(getLocalizedTypeLabel(defect.aiSuggestion.suggestedType, defect.aiSuggestion.suggestedTypeLabel))}. ${escapeHtml(getModelScoreText(defect.aiSuggestion.confidence, state.locale))}. ${escapeHtml(getAnalysisLabel(defect.aiSuggestion, state.locale))}.</p>`
                      : ""
                  }
                  <p class="review-indicator">${escapeHtml(getReviewLabel(defect.aiSuggestion, state.locale))}</p>
                  <p>${escapeHtml(defect.comment)}</p>
                  ${defect.aiSuggestion?.suggestionId ? `
                    <div class="action-row action-row--compact">
                      <button class="button button--secondary" type="button" data-defect-action="accept-ai" data-defect-id="${defect.id}">${escapeHtml(t("defect.acceptSuggestion"))}</button>
                      <button class="button button--plain" type="button" data-defect-action="manual-ai" data-defect-id="${defect.id}">${escapeHtml(t("defect.dismissSuggestion"))}</button>
                    </div>` : ""}
                  <div class="action-row action-row--compact defect-item__actions">
                    <button class="button" type="button" data-defect-action="reanalyse" data-defect-id="${defect.id}" ${getSelectedCvModel()?.configured ? "" : "disabled"}>${escapeHtml(state.locale === "en" ? "Reanalyze" : "Переанализировать")}</button>
                    <button class="button button--secondary" type="button" data-defect-action="edit" data-defect-id="${defect.id}">${escapeHtml(state.locale === "en" ? "Edit" : "Редактировать")}</button>
                    <button class="button button--danger" type="button" data-defect-action="delete" data-defect-id="${defect.id}">${escapeHtml(state.locale === "en" ? "Delete" : "Удалить")}</button>
                  </div>
                `
            }
          </div>
        </article>
      `
    })
    .join("")
}

function renderReports() {
  const reports = state.currentSessionBundle?.reports || []

  if (!state.currentSessionBundle || reports.length === 0) {
    elements.reportList.className = "report-list empty-state"
    elements.reportList.textContent = state.locale === "en" ? "No reports have been generated yet." : "Акты ещё не формировались."
    return
  }

  elements.reportList.className = "report-list"
  elements.reportList.innerHTML = reports
    .slice()
    .reverse()
    .map(
      (report) => `
        <article class="report-item">
          <div>
            <div class="subhead">
              <h4>${escapeHtml(state.locale === "en" ? "Report" : "Акт")} v${report.version}</h4>
              <span class="meta-note">${escapeHtml(formatDate(report.createdAt))}</span>
            </div>
            <p class="inline-note">${escapeHtml(
              state.locale === "en"
                ? "Generated from the saved session snapshot."
                : "Сформирован из сохранённого снимка сессии."
            )}</p>
          </div>
          <a href="${report.generatedDocument.publicPath}" target="_blank" rel="noreferrer">${escapeHtml(state.locale === "en" ? "Open report" : "Открыть акт")}</a>
        </article>
      `
    )
    .join("")
}

function renderReportSummary() {
  if (!state.currentSessionBundle) {
    elements.reportStepSummary.innerHTML = `
      <strong>${escapeHtml(state.locale === "en" ? "No active session" : "Нет активной сессии")}</strong>
      <p>${escapeHtml(state.locale === "en" ? "Go back and open a working session." : "Вернитесь назад и откройте рабочую сессию.")}</p>
    `
    elements.generateReportButton.disabled = true
    return
  }

  elements.reportStepSummary.innerHTML = `
      <strong>${escapeHtml(state.currentSessionBundle.project.name)}</strong>
      <p>${escapeHtml(state.locale === "en" ? "Defects in session" : "Дефектов в сессии")}: ${state.currentSessionBundle.defects.length}</p>
      <p>${escapeHtml(state.locale === "en" ? "Inspector" : "Инспектор")}: ${escapeHtml(
        state.currentSessionBundle.session.inspectorName ||
        (state.locale === "en" ? "Not specified" : "Не указан")
      )}</p>
      <p class="info-card__muted">${escapeHtml(
        state.locale === "en"
        ? "Built from saved defects and session data."
        : "Собирается из сохранённых дефектов и данных сессии."
      )}</p>
    `
  elements.generateReportButton.disabled = state.currentSessionBundle.defects.length === 0
}

function renderStepChrome() {
  const meta = getStepMeta(state.uiStep)
  elements.stepKicker.textContent = meta.kicker
  elements.stepTitle.textContent = meta.title
  elements.stepCopy.textContent = meta.copy

  elements.stepNavItems.forEach((item) => {
    const step = item.dataset.stepNav
    const stepIndex = stepMeta[step].index
    const isAvailable = isStepAvailable(step)
    item.classList.toggle("is-active", step === state.uiStep)
    item.classList.toggle("is-complete", stepIndex < meta.index)
    item.classList.toggle("is-locked", !isAvailable)
    item.disabled = !isAvailable
    item.setAttribute("aria-disabled", String(!isAvailable))
  })

  Object.entries(elements.screens).forEach(([step, node]) => {
    node.classList.toggle("hidden", step !== state.uiStep)
  })
}

function renderAll() {
  applyLocaleToStaticUi()
  renderPhotoSourceLabel()
  ensureUiStep()
  renderProjectOptions()
  renderProjectSummary()
  renderDefectTypeOptions()
  renderCvModelOptions()
  renderCvModelNotes()
  renderDemoScenarios()
  renderSuggestionPanel()
  renderActiveSession()
  renderDefectContext()
  renderDefects()
  renderReports()
  renderReportSummary()
  renderStepChrome()
}

async function requestSuggestionForImage(imageDataUrl, { preserveResults = false } = {}) {
  state.aiDecision = "pending_review"
  state.suggestionRequestId += 1
  const requestId = state.suggestionRequestId
  const selectedModel = getSelectedCvModel()
  const previousResults = preserveResults
    ? getSuccessfulComparisonResults().filter((item) => item.suggestion.analysisMode !== "precomputed_demo")
    : []
  state.activeDemoScenarioId = ""

  state.suggestionStatus = "loading"
  state.suggestionError = ""
  state.pendingSuggestion = null
  state.comparisonResults = previousResults
  resetDemoSaveState()
  renderSuggestionPanel()

  if (!selectedModel?.configured) {
    state.suggestionStatus = "error"
    state.suggestionError = "Live analysis is unavailable. Use a precomputed demo or manual entry."
    renderSuggestionPanel()
    return
  }

  try {
    const { suggestion } = await api("/api/ai/suggest", {
      method: "POST",
      body: JSON.stringify({
        imageDataUrl,
        modelKey: selectedModel.key
      })
    })

    if (requestId !== state.suggestionRequestId) {
      return
    }

    state.comparisonResults = [
      ...previousResults.filter((item) => item.modelKey !== selectedModel.key),
      { modelKey: selectedModel.key, modelLabel: selectedModel.label, ok: true, suggestion }
    ]
    state.pendingSuggestion = getPrimarySuggestionFromResults()

    if (!state.pendingSuggestion) {
      throw new Error(localizeRuntimeText("Ни одна подключённая модель не вернула пригодный результат."))
    }

    state.suggestionStatus = "ready"
    renderSuggestionPanel()
  } catch (error) {
    if (requestId !== state.suggestionRequestId) {
      return
    }

    state.pendingSuggestion = null
    state.comparisonResults = previousResults
    state.suggestionStatus = "error"
    state.suggestionError = error.message
    renderSuggestionPanel()
  }
}

async function refreshSessionBundle() {
  if (!state.currentSessionId) {
    state.currentSessionBundle = null
    renderAll()
    return
  }

  try {
    state.currentSessionBundle = await api(`/api/sessions/${state.currentSessionId}`)
    state.selectedProjectId = state.currentSessionBundle.project.id
    localStorage.setItem("constructai.selectedProjectId", state.selectedProjectId)

    if (
      state.editingDefectId &&
      !state.currentSessionBundle.defects.some((defect) => defect.id === state.editingDefectId)
    ) {
      state.editingDefectId = ""
    }
  } catch (error) {
    state.currentSessionId = ""
    state.currentSessionBundle = null
    localStorage.removeItem("constructai.currentSessionId")
    showStatus(error.message, "error")
  }

  renderAll()
}

async function saveDefectEdits(defectId, form) {
  const formData = new FormData(form)

  await api(`/api/defects/${encodeURIComponent(defectId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      defectType: formData.get("defectType"),
      locationDescription: formData.get("locationDescription"),
      comment: formData.get("comment")
    })
  })

  state.editingDefectId = ""
  await refreshSessionBundle()
  showStatus(state.locale === "en" ? "Defect has been updated." : "Дефект обновлён.")
}

async function removeDefect(defectId) {
  await api(`/api/defects/${encodeURIComponent(defectId)}`, {
    method: "DELETE"
  })

  state.editingDefectId = ""
  await refreshSessionBundle()
  showStatus(state.locale === "en" ? "Defect has been deleted." : "Дефект удалён.")
}

async function reanalyseDefect(defectId) {
  const selectedModel = getSelectedCvModel()

  if (!selectedModel) {
    throw new Error(localizeRuntimeText("Нет выбранной модели для переанализа."))
  }

  const { defect } = await api(`/api/defects/${encodeURIComponent(defectId)}/reanalyse`, {
    method: "POST",
    body: JSON.stringify({
      modelKey: selectedModel.key
    })
  })

  await refreshSessionBundle()
  showStatus(
    state.locale === "en"
      ? `Reanalysis completed with ${selectedModel.label}.`
      : `Переанализ выполнен моделью ${selectedModel.label}.`
  )
  return defect
}

async function applySelectedModel(modelKey) {
  state.selectedCvModelKey = modelKey
  localStorage.setItem("constructai.selectedCvModelKey", modelKey)
  renderCvModelOptions()
  renderCvModelNotes()

  const matchingSuggestion = getSuccessfulComparisonResults().find(
    (item) => item.modelKey === modelKey
  )

  if (matchingSuggestion) {
    state.aiDecision = "pending_review"
    state.pendingSuggestion = matchingSuggestion.suggestion
    state.suggestionStatus = "ready"
    state.suggestionError = ""
    renderSuggestionPanel()
    return
  }

  if (state.pendingImageDataUrl) {
    await requestSuggestionForImage(state.pendingImageDataUrl, { preserveResults: true })
  }
}

async function loadDemoScenarios() {
  try {
    const response = await fetch("/demo/scenarios.json", {
      headers: {
        accept: "application/json"
      }
    })

    if (!response.ok) {
      return []
    }

    return normalizeDemoScenarios(await response.json())
  } catch {
    return []
  }
}

async function imageUrlToDataUrl(imageUrl) {
  const response = await fetch(imageUrl)

  if (!response.ok) {
    throw new Error(localizeRuntimeText("Не удалось загрузить демо-фото."))
  }

  return fileToDataUrl(await response.blob())
}

async function applyDemoScenario(scenarioId) {
  const sourceScenario = getDemoScenario(scenarioId)

  if (!sourceScenario) {
    throw new Error(localizeRuntimeText("Демо-сценарий не найден."))
  }

  const scenario = getLocalizedDemoScenario(sourceScenario)

  state.suggestionRequestId += 1
  const requestId = state.suggestionRequestId
  state.activeDemoScenarioId = scenario.id
  state.aiDecision = "pending_review"
  state.pendingImageDataUrl = scenario.imageUrl
  state.pendingSuggestion = null
  state.comparisonResults = []
  state.suggestionStatus = "loading"
  state.suggestionError = ""
  resetDemoSaveState()
  elements.photoInput.value = ""
  renderAll()

  const imageDataUrl = await imageUrlToDataUrl(scenario.imageUrl)

  if (requestId !== state.suggestionRequestId) {
    return
  }

  const suggestion = {
    ...scenario.suggestion,
    suggestionId: crypto.randomUUID(),
    analysisMode: "precomputed_demo",
    demoScenarioId: scenario.id,
    status: "pending_review",
    review: { version: 1, decision: "pending_review", reviewedAt: null }
  }

  state.pendingImageDataUrl = imageDataUrl
  state.pendingSuggestion = suggestion
  state.comparisonResults = [
    {
      modelKey: suggestion.modelKey || "historical-demo",
      modelLabel: suggestion.modelLabel || (state.locale === "en" ? "Saved model" : "Сохранённая модель"),
      ok: true,
      suggestion
    }
  ]
  state.suggestionStatus = "ready"

  if (suggestion.suggestedType) {
    elements.defectTypeSelect.value = suggestion.suggestedType
  }

  if (scenario.locationDescription && elements.defectLocationInput) {
    elements.defectLocationInput.value = scenario.locationDescription
  }

  if (scenario.comment) {
    elements.commentInput.value = scenario.comment
    elements.commentInput.dataset.autofilled = "false"
    elements.commentInput.dataset.demoScenarioId = scenario.id
  }

  renderAll()
  showStatus(
    state.locale === "en"
      ? "Precomputed demo mask loaded. No live inference was run."
      : "Сохранённая демо-маска загружена. Новый анализ не запускался."
  )
}

async function saveCurrentDemoScenario() {
  if (!state.pendingImageDataUrl) {
    throw new Error(localizeRuntimeText("Нельзя сохранить demo без изображения."))
  }

  if (!state.pendingSuggestion) {
    throw new Error(localizeRuntimeText("Нельзя сохранить demo без AI-результата."))
  }

  state.demoSaveState = "saving"
  renderDemoSavePanel()

  const title = elements.demoSaveName?.value.trim() || getDefaultDemoTitle()
  const finalType = elements.defectTypeSelect?.value || state.pendingSuggestion.suggestedType

  try {
    const { scenario } = await api("/api/demo-scenarios", {
      method: "POST",
      body: JSON.stringify({
        title,
        imageDataUrl: state.pendingImageDataUrl,
        suggestion: state.pendingSuggestion,
        aiDecision: state.aiDecision,
        finalType,
        locationDescription: elements.defectLocationInput?.value || "",
        comment: elements.commentInput?.value || "",
        locale: state.locale
      })
    })

    if (scenario) {
      state.demoScenarios.unshift(scenario)
      state.activeDemoScenarioId = scenario.id
    }

    state.demoSaveState = "saved"
    renderAll()
    showStatus(state.locale === "en" ? "Demo scenario has been saved." : "Demo-сценарий сохранён.")
  } catch (error) {
    state.demoSaveState = "idle"
    renderDemoSavePanel()
    throw error
  }
}

async function deleteCurrentDemoScenario(scenarioId) {
  const scenario = getDemoScenario(scenarioId)

  if (!scenario) {
    throw new Error(localizeRuntimeText("Демо-сценарий не найден."))
  }

  const confirmed = window.confirm(
    state.locale === "en"
      ? `Delete the demo example "${getLocalizedDemoScenario(scenario).title}" from the local demo library?`
      : `Удалить demo-пример «${getLocalizedDemoScenario(scenario).title}» из локальной demo-библиотеки?`
  )

  if (!confirmed) {
    return
  }

  state.demoDeletingId = scenarioId
  renderDemoScenarios()

  try {
    await api(`/api/demo-scenarios/${encodeURIComponent(scenarioId)}`, {
      method: "DELETE"
    })

    state.demoScenarios = state.demoScenarios.filter((item) => item.id !== scenarioId)

    if (state.activeDemoScenarioId === scenarioId) {
      setPhotoPreview("")

      if (elements.photoInput) {
        elements.photoInput.value = ""
      }

      if (elements.defectLocationInput) {
        elements.defectLocationInput.value = ""
      }

      if (elements.commentInput) {
        elements.commentInput.value = ""
        delete elements.commentInput.dataset.autofilled
        delete elements.commentInput.dataset.demoScenarioId
      }
    }

    showStatus(
      state.locale === "en"
        ? "Demo scenario has been deleted."
        : "Demo-сценарий удалён."
    )
  } finally {
    state.demoDeletingId = ""
    renderAll()
  }
}

async function bootstrap() {
  const data = await api("/api/bootstrap", { method: "GET" })
  state.projects = data.projects
  state.defectCatalog = data.defectCatalog
  state.cvModels = Array.isArray(data.cvModels) ? data.cvModels : []
  state.demoLibraryWritable = data.runtime?.demoLibraryWritable === true
  state.demoScenarios = await loadDemoScenarios()

  if (!state.selectedCvModelKey) {
    state.selectedCvModelKey = data.defaultCvModelKey || state.cvModels[0]?.key || ""
  }

  if (!state.cvModels.some((item) => item.key === state.selectedCvModelKey)) {
    state.selectedCvModelKey = data.defaultCvModelKey || state.cvModels[0]?.key || ""
  }

  if (state.currentSessionId) {
    state.uiStep = "defect"
  } else if (state.selectedProjectId) {
    state.uiStep = "session"
  }

  renderAll()
  await refreshSessionBundle()
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () =>
      reject(new Error(localizeRuntimeText("Не удалось прочитать файл изображения.")))
    reader.readAsDataURL(file)
  })
}

elements.stepNavItems.forEach((item) => {
  item.addEventListener("click", () => {
    const step = item.dataset.stepNav
    setStep(step)
  })
})

elements.localeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLocale(button.dataset.localeSwitch)
  })
})

elements.photoTriggerButton?.addEventListener("click", () => {
  elements.photoInput?.click()
})

elements.projectChoice.addEventListener("change", (event) => {
  state.selectedProjectId = event.target.value

  if (state.selectedProjectId) {
    localStorage.setItem("constructai.selectedProjectId", state.selectedProjectId)
  } else {
    localStorage.removeItem("constructai.selectedProjectId")
  }

  renderAll()
})

elements.projectContinueButton.addEventListener("click", () => {
  if (!state.selectedProjectId && !state.currentSessionBundle) {
    showStatus(state.locale === "en" ? "Select a project first." : "Сначала выберите объект.", "error")
    return
  }

  if (state.currentSessionBundle) {
    setStep("defect")
    return
  }

  setStep("session")
})

elements.projectForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  clearStatus()

  const formData = new FormData(elements.projectForm)

  try {
    const { project } = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name"),
        address: formData.get("address"),
        description: formData.get("description")
      })
    })

    state.projects.push(project)
    state.projects.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    state.selectedProjectId = project.id
    localStorage.setItem("constructai.selectedProjectId", project.id)
    elements.projectForm.reset()
    setStep("session")
    showStatus(state.locale === "en" ? "Project has been created." : "Объект создан.")
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.sessionBackButton.addEventListener("click", () => setStep("project"))

elements.continueSessionButton.addEventListener("click", () => setStep("defect"))

elements.sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  clearStatus()

  if (!state.selectedProjectId) {
    showStatus(state.locale === "en" ? "Select a project first." : "Сначала выберите объект.", "error")
    return
  }

  const formData = new FormData(elements.sessionForm)

  try {
    const { session } = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        projectId: state.selectedProjectId,
        inspectorName: formData.get("inspectorName"),
        sessionNote: formData.get("sessionNote")
      })
    })

    state.currentSessionId = session.id
    localStorage.setItem("constructai.currentSessionId", session.id)
    await refreshSessionBundle()
    setStep("defect")
    showStatus(state.locale === "en" ? "Session has been opened." : "Сессия открыта.")
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.photoInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0]
  state.activeDemoScenarioId = ""
  delete elements.commentInput.dataset.demoScenarioId

  if (!file) {
    setPhotoPreview("")
    return
  }

  try {
    const dataUrl = await fileToDataUrl(file)
    setPhotoPreview(dataUrl)
    await requestSuggestionForImage(dataUrl)
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.demoScenarios.addEventListener("click", async (event) => {
  clearStatus()

  try {
    const deleteTrigger = event.target.closest("[data-demo-delete-id]")

    if (deleteTrigger) {
      await deleteCurrentDemoScenario(deleteTrigger.dataset.demoDeleteId)
      return
    }

    const trigger = event.target.closest("[data-demo-scenario-id]")

    if (!trigger) {
      return
    }

    await applyDemoScenario(trigger.dataset.demoScenarioId)
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.demoSaveButton?.addEventListener("click", async () => {
  clearStatus()

  try {
    await saveCurrentDemoScenario()
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.demoDismissButton?.addEventListener("click", () => {
  state.demoSaveState = "dismissed"
  renderDemoSavePanel()
  showStatus(
    state.locale === "en"
      ? "Demo save skipped for the current photo."
      : "Сохранение demo отменено для текущего фото."
  )
})

elements.defectModelSelect.addEventListener("change", async (event) => {
  clearStatus()

  try {
    await applySelectedModel(event.target.value)
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.reportModelSelect.addEventListener("change", async (event) => {
  clearStatus()

  try {
    await applySelectedModel(event.target.value)
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.defectTypeSelect.addEventListener("change", () => {
  if (state.pendingSuggestion) {
    state.aiDecision = transitionReviewDecision(
      state.aiDecision, "type_changed", state.pendingSuggestion.suggestedType,
      elements.defectTypeSelect.value
    )
  }
  delete elements.commentInput.dataset.demoScenarioId
  updateDefectHints()
})
elements.commentInput.addEventListener("input", () => {
  elements.commentInput.dataset.autofilled = "false"
  delete elements.commentInput.dataset.demoScenarioId
})

elements.acceptSuggestionButton.addEventListener("click", () => {
  if (!state.pendingSuggestion) {
    return
  }

  elements.defectTypeSelect.value = state.pendingSuggestion.suggestedType
  state.aiDecision = "accepted"
  updateDefectHints()
  showStatus(
    state.locale === "en"
      ? "Type from AI suggestion has been applied."
      : "Тип из AI-подсказки применён."
  )
})

elements.dismissSuggestionButton.addEventListener("click", () => {
  state.aiDecision = state.pendingSuggestion ? "manual" : "pending_review"
  renderSuggestionPanel()
  elements.defectTypeSelect.focus()
  showStatus(state.locale === "en" ? "Manual selection kept." : "Оставлен ручной выбор.")
})

elements.suggestionContent.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-compare-model-key]")

  if (!button) {
    return
  }

  clearStatus()

  try {
    await applySelectedModel(button.dataset.compareModelKey)
    showStatus(
      state.locale === "en"
        ? `Primary model switched to ${getCvModelLabel(button.dataset.compareModelKey)}.`
        : `Основной стала модель ${getCvModelLabel(button.dataset.compareModelKey)}.`
    )
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.defectBackButton.addEventListener("click", () => setStep("session"))
elements.jumpToReportButton.addEventListener("click", () => setStep("report"))
elements.newDefectButton.addEventListener("click", () => setStep("defect"))

elements.defectForm.addEventListener("submit", async (event) => {
  event.preventDefault()
  clearStatus()

  if (state.suggestionStatus === "loading") {
    showStatus(state.locale === "en" ? "Wait for the current image to finish loading." : "Дождитесь загрузки текущего изображения.", "error")
    return
  }

  if (!state.currentSessionId) {
    showStatus(state.locale === "en" ? "Open a session first." : "Сначала откройте сессию.", "error")
    return
  }

  if (!state.pendingImageDataUrl) {
    showStatus(state.locale === "en" ? "Add a defect photo first." : "Нужно добавить фото дефекта.", "error")
    return
  }

  const formData = new FormData(elements.defectForm)

  try {
    await api("/api/defects", {
      method: "POST",
      body: JSON.stringify({
        sessionId: state.currentSessionId,
        defectType: formData.get("defectType"),
        locationDescription: formData.get("locationDescription"),
        comment: formData.get("comment"),
        imageDataUrl: state.pendingImageDataUrl,
        aiSuggestion:
          state.suggestionStatus === "ready" ? state.pendingSuggestion : null,
        aiDecision: state.aiDecision
      })
    })

    elements.defectForm.reset()
    elements.photoInput.value = ""
    setPhotoPreview("")
    resetSuggestionState()
    elements.commentInput.dataset.autofilled = "true"
    delete elements.commentInput.dataset.demoScenarioId
    renderDefectTypeOptions()
    await refreshSessionBundle()
    setStep("report")
    showStatus(state.locale === "en" ? "Defect has been saved." : "Дефект сохранён.")
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.generateReportButton.addEventListener("click", async () => {
  clearStatus()

  if (!state.currentSessionId) {
    showStatus(state.locale === "en" ? "Open a session first." : "Сначала откройте сессию.", "error")
    return
  }

  try {
    const { report } = await api("/api/reports", {
      method: "POST",
      body: JSON.stringify({
        sessionId: state.currentSessionId,
        reportLocale: state.locale
      })
    })

    await refreshSessionBundle()
    showStatus(
      state.locale === "en"
        ? `Report v${report.version} has been generated.`
        : `Акт v${report.version} сформирован.`
    )
    window.open(report.generatedDocument.publicPath, "_blank", "noopener")
  } catch (error) {
    showStatus(error.message, "error")
  }
})

elements.defectList.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-defect-action]")

  if (!actionButton) {
    return
  }

  const { defectAction, defectId } = actionButton.dataset

  if (!defectId) {
    return
  }

  if (defectAction === "edit") {
    state.editingDefectId = defectId
    renderDefects()
    return
  }

  if (defectAction === "cancel-edit") {
    state.editingDefectId = ""
    renderDefects()
    return
  }

  if (defectAction === "accept-ai" || defectAction === "manual-ai") {
    const defect = state.currentSessionBundle?.defects.find((item) => item.id === defectId)
    if (!defect?.aiSuggestion) return
    try {
      await api(`/api/defects/${encodeURIComponent(defectId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          defectType: defectAction === "accept-ai" ? defect.aiSuggestion.suggestedType : defect.defectType,
          comment: defect.comment,
          locationDescription: defect.locationDescription,
          aiDecision: defectAction === "accept-ai" ? "accepted" : "manual",
          reviewSuggestionId: defect.aiSuggestion.suggestionId
        })
      })
      await refreshSessionBundle()
    } catch (error) {
      showStatus(error.message, "error")
    }
    return
  }

  if (defectAction === "delete") {
    const confirmed = window.confirm(
      state.locale === "en"
        ? "Delete this defect from the current session? Reports already generated will remain as saved snapshots."
        : "Удалить дефект из текущей сессии? Уже сформированные акты останутся как сохранённые снимки."
    )

    if (!confirmed) {
      return
    }

    clearStatus()

    try {
      await removeDefect(defectId)
    } catch (error) {
      showStatus(error.message, "error")
    }
  }

  if (defectAction === "reanalyse") {
    clearStatus()

    try {
      await reanalyseDefect(defectId)
    } catch (error) {
      showStatus(error.message, "error")
    }
  }
})

elements.defectList.addEventListener("submit", async (event) => {
  const form = event.target.closest(".defect-edit-form")

  if (!form) {
    return
  }

  event.preventDefault()
  clearStatus()

  try {
    await saveDefectEdits(form.dataset.defectId, form)
  } catch (error) {
    showStatus(error.message, "error")
  }
})

bootstrap().catch((error) => {
  showStatus(error.message, "error")
})
