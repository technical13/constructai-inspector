const copy = {
  en: {
    caption: "Visual inspection prototype", eyebrow: "Computer vision / Experimental",
    photoAlt: "Concrete surface selected for analysis", imageAnalysis: "Image analysis", analysisMode: "Analysis mode",
    title: "Crack analysis", intro: "Your photo. A model-generated contour. Your judgment.",
    live: "Try your photo", demo: "Demo examples", choose: "Choose photo", analyze: "Analyze photo",
    clear: "Clear", empty: "Start with a concrete-surface photo.",
    emptyHint: "JPEG, PNG or WebP · up to 12 MiB / 12 megapixels",
    consent: "I can share this non-sensitive photo with Hugging Face for analysis.",
    privacy: "Photos are resized before sending. No project records are saved here; Hugging Face may temporarily cache uploads and results.",
    limitation: "Experimental output, not a structural-safety assessment. False positives and missed cracks are possible.",
    quota: "Free shared GPU · queues and daily limits apply.",
    demoNote: "Precomputed AI masks. Choosing an example does not run a new analysis.",
    demoEmpty: "Demo examples could not be loaded. Please reload the page.",
    example: "Example", original: "Show original", mask: "Show mask",
    pending: "Waiting for shared GPU and live analysis…", preparing: "Preparing photo locally…",
    liveResult: "Live analysis · Human review required", demoResult: "Precomputed demo · Human review required",
    score: "Model score", scoreNote: "Not validated accuracy or a calibrated probability.",
    noMask: "No contour mask was returned. This does not prove that the surface is defect-free.",
    crack: "Possible crack", corrosion: "Model suggested corrosion", spalling: "Model suggested spalling",
    honeycombing: "Model suggested honeycombing", leakage: "Model suggested leakage",
    geometry: "Model suggested a geometry issue", unfinished: "Model suggested unfinished work",
    other: "No confident crack detection", unknownScore: "Not available",
    unavailable: "Live analysis is unavailable. Demo examples remain available.",
    failed: "Analysis could not complete. You can choose a demo example instead.",
    RATE_LIMITED: "Please wait before another analysis. Shared GPU capacity is limited.",
    SERVICE_BUSY: "Another analysis is running. Please try later or choose a demo.",
    GPU_QUOTA_EXCEEDED: "The shared GPU allowance is exhausted. Try later or choose a precomputed demo.",
    ANALYSIS_TIMEOUT: "The GPU queue or analysis took too long. Try later; no demo result was substituted.",
    INVALID_RESULT: "The model result could not be verified. No mask is shown.",
    INVALID_IMAGE: "Choose a valid JPEG, PNG or WebP photo.",
    IMAGE_TOO_LARGE: "Choose a smaller photo: at most 12 MiB and 12 megapixels before resizing.",
    CONSENT_REQUIRED: "Confirm that this photo may be sent to Hugging Face.",
    noSensitive: "Do not upload confidential site photos, faces, or personal information.",
    about: "How it works", aboutCopy: "SAM 3 segments possible cracks using a fixed text prompt, without a separate detector. A contour is a model suggestion, not proof of a crack. Historical demo examples retain their original model labels. Reports and the full inspection workflow are available in the local application.",
    source: "Source & local setup", waiting: "Choose a photo to begin.", ready: "Photo ready. Confirm sharing, then analyze.", selectDemo: "Choose a prepared example below."
  },
  ru: {
    caption: "Прототип визуального осмотра", eyebrow: "Компьютерное зрение / Прототип",
    photoAlt: "Бетонная поверхность для анализа", imageAnalysis: "Анализ изображения", analysisMode: "Режим анализа",
    title: "Анализ трещин", intro: "Ваше фото. Контур от модели. Ваша оценка.",
    live: "Своё фото", demo: "Демо-примеры", choose: "Выбрать фото", analyze: "Проанализировать",
    clear: "Очистить", empty: "Начните с фотографии бетонной поверхности.",
    emptyHint: "JPEG, PNG или WebP · до 12 МиБ / 12 мегапикселей",
    consent: "Я могу передать это несекретное фото в Hugging Face для анализа.",
    privacy: "Перед отправкой фото уменьшается. Записи об объектах здесь не создаются; Hugging Face может временно кэшировать фото и результаты.",
    limitation: "Экспериментальный результат, не оценка безопасности конструкции. Возможны ложные срабатывания и пропущенные трещины.",
    quota: "Общий бесплатный GPU · возможны очереди и суточные лимиты.",
    demoNote: "Заранее рассчитанные AI-маски. Выбор примера не запускает новый анализ.",
    demoEmpty: "Не удалось загрузить демо-примеры. Обновите страницу.",
    example: "Пример", original: "Показать оригинал", mask: "Показать маску",
    pending: "Ожидание общего GPU и анализ…", preparing: "Подготовка фото на устройстве…",
    liveResult: "Онлайн-анализ · Нужна проверка человеком", demoResult: "Готовый демо-результат · Нужна проверка человеком",
    score: "Оценка модели", scoreNote: "Не подтверждённая точность и не калиброванная вероятность.",
    noMask: "Модель не вернула контурную маску. Это не доказывает отсутствие дефектов.",
    crack: "Возможная трещина", corrosion: "Модель предположила коррозию", spalling: "Модель предположила скол",
    honeycombing: "Модель предположила раковины", leakage: "Модель предположила протечку",
    geometry: "Модель предположила нарушение геометрии", unfinished: "Модель предположила незавершённую работу",
    other: "Уверенного обнаружения трещины нет", unknownScore: "Нет данных",
    unavailable: "Онлайн-анализ недоступен. Демо-примеры остаются доступны.",
    failed: "Не удалось завершить анализ. Можно выбрать готовый демо-пример.",
    RATE_LIMITED: "Подождите перед следующим анализом. Общий GPU ограничен.",
    SERVICE_BUSY: "Другой анализ ещё выполняется. Попробуйте позже или выберите демо.",
    GPU_QUOTA_EXCEEDED: "Общая GPU-квота исчерпана. Попробуйте позже или выберите готовое демо.",
    ANALYSIS_TIMEOUT: "Очередь GPU или анализ заняли слишком много времени. Попробуйте позже; демо не подставлялось.",
    INVALID_RESULT: "Результат модели не прошёл проверку. Маска не показана.",
    INVALID_IMAGE: "Выберите корректное фото JPEG, PNG или WebP.",
    IMAGE_TOO_LARGE: "Выберите фото меньше: до 12 МиБ и 12 мегапикселей до уменьшения.",
    CONSENT_REQUIRED: "Подтвердите передачу фото в Hugging Face.",
    noSensitive: "Не загружайте конфиденциальные фото объекта, лица и персональные данные.",
    about: "Как это работает", aboutCopy: "SAM 3 выделяет возможные трещины по фиксированному текстовому запросу, без отдельного детектора. Контур — предположение модели, а не доказательство трещины. Старые демо сохраняют название исходной модели. Акты и полный рабочий сценарий доступны в локальном приложении.",
    source: "Код и локальный запуск", waiting: "Выберите фото для начала.", ready: "Фото готово. Подтвердите передачу и запустите анализ.", selectDemo: "Выберите готовый пример ниже."
  }
}

export function previewCopy(locale) {
  return copy[locale === "ru" ? "ru" : "en"]
}

export function describePreviewResult(suggestion, locale) {
  const t = previewCopy(locale)
  return {
    title: t[suggestion?.suggestedType] || t.other,
    score: typeof suggestion?.confidence === "number" && Number.isFinite(suggestion.confidence)
      ? suggestion.confidence.toFixed(3) : t.unknownScore,
    provenance: `${suggestion?.analysisMode === "precomputed_demo" ? t.demoResult : t.liveResult}${suggestion?.modelLabel ? ` · ${suggestion.modelLabel}` : ""}`
  }
}

export function demoPreview(scenario) {
  return {
    ...scenario.suggestion,
    analysisMode: "precomputed_demo",
    status: "pending_review"
  }
}

export class PreviewRun {
  #revision = 0
  invalidate() { return ++this.#revision }
  isCurrent(revision) { return revision === this.#revision }
}
