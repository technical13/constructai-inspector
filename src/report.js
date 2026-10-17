import { getLocalizedDefectTypeMeta } from "./catalog.js"
import { getReviewLabel, getModelScoreText, getAnalysisLabel, localizeRegionLabel } from "../public/ai-review.js"

function normalizeReportLocale(locale) {
  return locale === "en" ? "en" : "ru"
}

const reportText = {
  ru: {
    statusAccepted: "AI подтверждён",
    statusCorrected: "AI исправлен",
    statusPending: "AI-подсказка",
    withVisualHighlight: "с визуальной подсветкой",
    defectPhotoAlt: "Фото дефекта {index}",
    defectTitle: "Дефект {index}",
    location: "Расположение",
    comment: "Комментарий",
    notSpecified: "Не указано",
    aiSuggested: "AI предложил",
    aiFinal: "Финально сохранено",
    decision: "Решение оператора",
    reviewNote: "Решение относится к выбору типа дефекта, а не к оценке безопасности конструкции.",
    scoreNote: "Оценка модели не калибрована как вероятность и не является независимо проверенной точностью.",
    demoNote: "Демо: показана ранее полученная сегментационная маска. Новый анализ не выполнялся.",
    title: "Акт стройконтроля",
    reportTitle: "Акт фиксации дефектов",
    reportIntro: "Сформирован автоматически по сохранённым данным инспекции.",
    generatedAt: "Сформировано",
    summary: "Сводка",
    project: "Объект",
    address: "Адрес",
    inspector: "Инспектор",
    sessionStarted: "Сессия начата",
    sessionComment: "Комментарий к сессии",
    defectCount: "Количество дефектов",
    defectsList: "Перечень дефектов",
    noDefects: "В сессии отсутствуют зафиксированные дефекты.",
    footer: "Отчёт воспроизводим из сохранённого снимка сессии."
  },
  en: {
    statusAccepted: "AI accepted",
    statusCorrected: "AI corrected",
    statusPending: "AI suggestion",
    withVisualHighlight: "with visual highlight",
    defectPhotoAlt: "Defect photo {index}",
    defectTitle: "Defect {index}",
    location: "Location",
    comment: "Comment",
    notSpecified: "Not specified",
    aiSuggested: "AI suggested",
    aiFinal: "Final saved type",
    decision: "Operator decision",
    reviewNote: "The decision records the defect type selection, not a structural safety assessment.",
    scoreNote: "The model score is not a calibrated probability or independently validated accuracy.",
    demoNote: "Demo: this image uses a previously generated segmentation mask. No live inference was run.",
    title: "Construction inspection report",
    reportTitle: "Defect inspection report",
    reportIntro: "Generated automatically from the saved inspection data.",
    generatedAt: "Generated",
    summary: "Summary",
    project: "Project",
    address: "Address",
    inspector: "Inspector",
    sessionStarted: "Session started",
    sessionComment: "Session comment",
    defectCount: "Defect count",
    defectsList: "Defect list",
    noDefects: "There are no recorded defects in this session.",
    footer: "The report is reproducible from the saved session snapshot."
  }
}

function tr(locale, key, vars = {}) {
  const template = reportText[normalizeReportLocale(locale)][key] || key

  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template
  )
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatDateTime(value, locale = "ru") {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ru-RU", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value))
}

function clampUnit(value) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return 0
  }

  return Math.max(0, Math.min(1, numeric))
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

function getDisplayVisualEvidence(defect, locale) {
  const visualEvidence = defect.aiSuggestion?.visualEvidence || null

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
      label: localizeRegionLabel(
        region.label,
        getLocalizedDefectTypeMeta(defect.aiSuggestion?.suggestedType, locale).label,
        locale
      ),
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
  if (!visualEvidence) {
    return ""
  }

  const regions = getRenderableRegions(visualEvidence)

  if (regions.length === 0) {
    return ""
  }

  const overlaySize = getOverlaySize(visualEvidence)
  const renderMode = visualEvidence.renderMode === "mask" ? "mask" : "vector"
  const maskMarkup =
    renderMode === "mask" && typeof visualEvidence.maskDataUrl === "string"
      ? `<image class="detection-overlay__mask" href="${escapeHtml(visualEvidence.maskDataUrl)}" x="0" y="0" width="${overlaySize.width}" height="${overlaySize.height}" preserveAspectRatio="${overlaySize.preserveAspectRatio}" />`
      : ""
  const vectorMarkup = regions
    .map((region) => {
      const regionLabel = region.label || overlayLabel
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

      if (region.kind === "box") {
        const x = toViewBoxPoint(region.x, overlaySize.width)
        const y = toViewBoxPoint(region.y, overlaySize.height)
        const width = toViewBoxPoint(region.width, overlaySize.width)
        const height = toViewBoxPoint(region.height, overlaySize.height)

        shapeMarkup =
          renderMode === "mask"
            ? ""
            : `<rect class="detection-overlay__box" x="${x}" y="${y}" width="${width}" height="${height}" rx="4" ry="4" />`
      } else if (region.kind === "polygon") {
        const points = region.points
          .map(
            (point) =>
              `${toViewBoxPoint(point.x, overlaySize.width)},${toViewBoxPoint(point.y, overlaySize.height)}`
          )
          .join(" ")

        shapeMarkup = `<polygon class="detection-overlay__trace detection-overlay__trace--polygon" points="${points}" />`
      } else {
        const points = region.points
          .map(
            (point) =>
              `${toViewBoxPoint(point.x, overlaySize.width)},${toViewBoxPoint(point.y, overlaySize.height)}`
          )
          .join(" ")

        shapeMarkup = `<polyline class="detection-overlay__trace" points="${points}" />`
      }

      return `
        ${shapeMarkup}
        ${labelMarkup}
      `
    })
    .join("")

  return `
    <svg class="detection-overlay" viewBox="0 0 ${overlaySize.width} ${overlaySize.height}" preserveAspectRatio="${overlaySize.preserveAspectRatio}" aria-hidden="true">
      ${maskMarkup}
      ${vectorMarkup}
    </svg>
  `
}

function renderReportPhoto(photo, defect, locale) {
  const visualEvidence = getDisplayVisualEvidence(defect, locale)
  const overlay = renderVisualEvidence(
    visualEvidence,
    getLocalizedDefectTypeMeta(defect.aiSuggestion?.suggestedType, locale).label ||
      defect.aiSuggestion?.suggestedTypeLabel ||
      ""
  )

  return `
    <figure class="inspection-photo">
      <img src="${escapeHtml(photo.publicPath)}" alt="${escapeHtml(tr(locale, "defectPhotoAlt", { index: defect.index }))}" />
      ${overlay}
      ${
        defect.aiSuggestion?.modelLabel
          ? `<span class="inspection-photo__meta">${escapeHtml(defect.aiSuggestion.modelLabel)}</span>`
          : ""
      }
      ${
        defect.aiSuggestion
          ? `<figcaption class="inspection-photo__caption">${escapeHtml(getReviewLabel(defect.aiSuggestion, locale))}${visualEvidence ? ` · ${escapeHtml(tr(locale, "withVisualHighlight"))}` : ""}</figcaption>`
          : ""
      }
    </figure>
  `
}

export function buildReportSnapshot({ project, session, defects, reportLocale = "ru" }) {
  const locale = normalizeReportLocale(reportLocale)

  return {
    reportLocale: locale,
    project: {
      id: project.id,
      name: project.name,
      address: project.address,
      description: project.description
    },
    session: {
      id: session.id,
      inspectorName: session.inspectorName,
      sessionNote: session.sessionNote,
      createdAt: session.createdAt
    },
    defects: defects.map((defect, index) => ({
      index: index + 1,
      id: defect.id,
      defectType: defect.defectType,
      defectTypeLabel: getLocalizedDefectTypeMeta(defect.defectType, locale).label,
      comment: defect.comment,
      locationDescription: defect.locationDescription,
      aiSuggestion: defect.aiSuggestion ? structuredClone(defect.aiSuggestion) : null,
      createdAt: defect.createdAt,
      photos: defect.photos.map((photo) => ({
        id: photo.id,
        fileName: photo.fileName,
        publicPath: photo.publicPath,
        mimeType: photo.mimeType,
        createdAt: photo.createdAt
      }))
    })),
    generatedAt: new Date().toISOString()
  }
}

export function renderReportHtml(snapshot) {
  const locale = normalizeReportLocale(snapshot.reportLocale)
  const defectRows = snapshot.defects
    .map((defect) => {
      const photos = defect.photos
        .map((photo) => renderReportPhoto(photo, defect, locale))
        .join("")

      return `
        <section class="defect-card">
          <div class="defect-card__header">
            <div>
              <p class="eyebrow">${escapeHtml(tr(locale, "defectTitle", { index: defect.index }))}</p>
              <h3>${escapeHtml(getLocalizedDefectTypeMeta(defect.defectType, locale).label)}</h3>
            </div>
            <p class="muted">${escapeHtml(formatDateTime(defect.createdAt, locale))}</p>
          </div>
          <div class="defect-grid">
            <div class="summary-item">
              <p class="field-label">${escapeHtml(tr(locale, "location"))}</p>
              <p>${escapeHtml(defect.locationDescription || tr(locale, "notSpecified"))}</p>
            </div>
            <div class="summary-item">
              <p class="field-label">${escapeHtml(tr(locale, "comment"))}</p>
              <p>${escapeHtml(defect.comment)}</p>
            </div>
          </div>
          <p class="ai-note"><strong>${escapeHtml(tr(locale, "decision"))}: ${escapeHtml(getReviewLabel(defect.aiSuggestion, locale))}</strong>. ${escapeHtml(tr(locale, "reviewNote"))}</p>
          ${
            defect.aiSuggestion
              ? `<p class="ai-note">${escapeHtml(tr(locale, "aiSuggested"))}: ${escapeHtml(getLocalizedDefectTypeMeta(defect.aiSuggestion.suggestedType, locale).label)}. ${escapeHtml(getModelScoreText(defect.aiSuggestion.confidence, locale))}. ${escapeHtml(tr(locale, "aiFinal"))}: ${escapeHtml(getLocalizedDefectTypeMeta(defect.defectType, locale).label)}. ${escapeHtml(defect.aiSuggestion.modelLabel || defect.aiSuggestion.sourceLabel)} · ${escapeHtml(getAnalysisLabel(defect.aiSuggestion, locale))}.</p>
                <p class="ai-note">${escapeHtml(tr(locale, "scoreNote"))}</p>
                ${defect.aiSuggestion.analysisMode === "precomputed_demo" ? `<p class="ai-note">${escapeHtml(tr(locale, "demoNote"))}</p>` : ""}`
              : ""
          }
          <div class="photo-strip">${photos}</div>
        </section>
      `
    })
    .join("")

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(tr(locale, "title"))}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #151718;
        --ink-soft: #52554f;
        --muted: #71736d;
        --line: #bbb7aa;
        --line-soft: #d4d0c4;
        --panel: #fbfaf5;
        --panel-soft: #e8e5da;
        --bg: #d5d1c4;
        --paper: #f3f1e8;
        --signal: #f2e600;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        border-top: 4px solid var(--ink);
        font-family: "IBM Plex Sans", "Helvetica Neue", "Segoe UI", system-ui, sans-serif;
        color: var(--ink);
        background: var(--bg);
      }
      main {
        max-width: 820px;
        margin: 0 auto;
        padding: 24px 14px 32px;
      }
      .report-shell {
        position: relative;
        padding: 22px;
        border: 1px solid var(--ink);
        border-radius: 4px;
        background: var(--panel);
      }
      .report-shell::before {
        content: "";
        position: absolute;
        top: -1px;
        left: 24px;
        width: 72px;
        height: 5px;
        background: var(--signal);
      }
      .report-header {
        display: grid;
        gap: 18px;
        padding: 14px 0 22px;
        border-bottom: 1px solid var(--ink);
      }
      .brand-row {
        display: grid;
        grid-template-columns: 22px minmax(0, 1fr);
        gap: 12px;
        align-items: start;
      }
      .brand-mark {
        position: relative;
        width: 20px;
        height: 52px;
        border-radius: 999px;
        background: var(--ink);
      }
      .brand-mark span {
        position: absolute;
        inset: 7px 9px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.22);
      }
      .brand-mark span:last-child {
        inset: 16px 7px 16px auto;
        width: 3px;
        background: rgba(255, 255, 255, 0.88);
      }
      .report-header h1 {
        max-width: 12ch;
        margin: 10px 0 0;
        font-size: clamp(2.35rem, 7vw, 4rem);
        line-height: 0.92;
        letter-spacing: -0.045em;
        font-weight: 500;
      }
      .eyebrow {
        margin: 0;
        color: var(--muted);
        font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .intro {
        margin-top: 10px;
        max-width: 44ch;
        line-height: 1.45;
      }
      .muted,
      .field-label {
        color: var(--muted);
      }
      .meta-block,
      .summary-item,
      .defect-card,
      .ai-note {
        border: 1px solid var(--line);
        border-radius: 2px;
        background: var(--panel);
      }
      .meta-block,
      .summary-item,
      .ai-note {
        padding: 14px;
      }
      .field-label {
        margin: 0 0 6px;
        font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .section {
        margin-top: 24px;
      }
      .section h2 {
        margin: 0 0 14px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--ink);
        font-size: 22px;
        font-weight: 500;
        letter-spacing: -0.035em;
      }
      .summary-grid,
      .defect-grid,
      .photo-strip {
        display: grid;
        gap: 12px;
        grid-template-columns: 1fr;
      }
      .summary-item p,
      .defect-card p,
      .ai-note {
        margin: 0;
        line-height: 1.45;
      }
      .defect-card {
        padding: 18px;
        background: var(--paper);
      }
      .defect-card + .defect-card {
        margin-top: 8px;
      }
      .defect-card__header {
        display: grid;
        gap: 12px;
        margin-bottom: 14px;
      }
      .defect-card__header h3 {
        margin: 8px 0 0;
        font-size: 26px;
        font-weight: 500;
        letter-spacing: -0.035em;
      }
      .photo-strip {
        margin-top: 16px;
      }
      .inspection-photo {
        position: relative;
        margin: 0;
        min-height: 0;
        overflow: hidden;
        border: 1px solid var(--ink);
        border-radius: 2px;
        background: var(--panel-soft);
      }
      .inspection-photo img {
        display: block;
        width: 100%;
        height: auto;
        object-fit: contain;
      }
      .inspection-photo__meta {
        position: absolute;
        top: 10px;
        right: 10px;
        padding: 5px 8px;
        border-radius: 2px;
        background: rgba(243, 241, 232, 0.9);
        border: 1px solid rgba(21, 23, 24, 0.48);
        color: var(--ink-soft);
        font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .inspection-photo__caption {
        position: absolute;
        left: 10px;
        bottom: 10px;
        margin: 0;
        padding: 7px 10px;
        border-left: 3px solid var(--signal);
        border-radius: 2px;
        background: rgba(21, 23, 24, 0.9);
        color: var(--panel);
        font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.02em;
      }
      .detection-overlay {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .detection-overlay__mask {
        opacity: 0.88;
        filter: saturate(108%) drop-shadow(0 0 5px rgba(242, 230, 0, 0.28));
      }
      .detection-overlay__box {
        fill: rgba(242, 230, 0, 0.1);
        stroke: var(--signal);
        stroke-width: 3;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 0 5px rgba(242, 230, 0, 0.48));
      }
      .detection-overlay__trace {
        fill: none;
        stroke: var(--signal);
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
        filter: drop-shadow(0 0 4px rgba(242, 230, 0, 0.48));
      }
      .detection-overlay__trace--polygon {
        fill: rgba(242, 230, 0, 0.1);
      }
      .detection-overlay__region-label-bg {
        fill: rgba(20, 23, 27, 0.82);
        stroke: rgba(255, 242, 63, 0.94);
        stroke-width: 0.9;
        vector-effect: non-scaling-stroke;
      }
      .detection-overlay__region-label-text {
        fill: #fffef4;
        font-size: 8px;
        font-weight: 600;
        letter-spacing: 0.03em;
      }
      .ai-note {
        margin-top: 16px;
        background: var(--panel-soft);
        border-left: 4px solid var(--signal);
      }
      .footer {
        margin-top: 22px;
        padding-top: 18px;
        border-top: 1px solid var(--ink);
        color: var(--muted);
        font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
        font-size: 11px;
        line-height: 1.5;
      }
      @media (min-width: 720px) {
        .report-header {
          grid-template-columns: minmax(0, 1fr) 220px;
          align-items: start;
        }
        .summary-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .defect-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media print {
        body {
          background: #fff;
        }
        main {
          max-width: none;
          padding: 0;
        }
        .report-shell {
          border: none;
          border-radius: 0;
          padding: 0;
        }
        .report-shell::before {
          display: none;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <article class="report-shell">
        <header class="report-header">
          <div class="brand-row">
            <div class="brand-mark" aria-hidden="true"><span></span><span></span></div>
            <div>
              <p class="eyebrow">ConstructAI Inspector</p>
              <h1>${escapeHtml(tr(locale, "reportTitle"))}</h1>
              <p class="muted intro">${escapeHtml(tr(locale, "reportIntro"))}</p>
            </div>
          </div>
          <aside class="meta-block">
            <p class="field-label">${escapeHtml(tr(locale, "generatedAt"))}</p>
            <p>${escapeHtml(formatDateTime(snapshot.generatedAt, locale))}</p>
          </aside>
        </header>

        <section class="section">
          <h2>${escapeHtml(tr(locale, "summary"))}</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <p class="field-label">${escapeHtml(tr(locale, "project"))}</p>
              <p>${escapeHtml(snapshot.project.name)}</p>
            </div>
            <div class="summary-item">
              <p class="field-label">${escapeHtml(tr(locale, "address"))}</p>
              <p>${escapeHtml(snapshot.project.address || tr(locale, "notSpecified"))}</p>
            </div>
            <div class="summary-item">
              <p class="field-label">${escapeHtml(tr(locale, "inspector"))}</p>
              <p>${escapeHtml(snapshot.session.inspectorName || tr(locale, "notSpecified"))}</p>
            </div>
            <div class="summary-item">
              <p class="field-label">${escapeHtml(tr(locale, "sessionStarted"))}</p>
              <p>${escapeHtml(formatDateTime(snapshot.session.createdAt, locale))}</p>
            </div>
            <div class="summary-item">
              <p class="field-label">${escapeHtml(tr(locale, "sessionComment"))}</p>
              <p>${escapeHtml(snapshot.session.sessionNote || tr(locale, "notSpecified"))}</p>
            </div>
            <div class="summary-item">
              <p class="field-label">${escapeHtml(tr(locale, "defectCount"))}</p>
              <p>${escapeHtml(String(snapshot.defects.length))}</p>
            </div>
          </div>
        </section>

        <section class="section">
          <h2>${escapeHtml(tr(locale, "defectsList"))}</h2>
          ${defectRows || `<p class="muted">${escapeHtml(tr(locale, "noDefects"))}</p>`}
        </section>

        <footer class="footer">
          ${escapeHtml(tr(locale, "footer"))}
        </footer>
      </article>
    </main>
  </body>
</html>`
}
