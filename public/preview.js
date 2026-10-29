import { previewCopy, describePreviewResult, demoPreview, PreviewRun } from "./preview-contract.js"
import { selectPhotoFile, bindPhotoDropZone, guardFileNavigation } from "./photo-input.js"

const $ = id => document.getElementById(id)
const run = new PreviewRun()
let locale = "en"
try { if (localStorage.getItem("constructai.preview.locale") === "ru") locale = "ru" } catch { /* Storage is optional. */ }
let mode = "live"
let imageDataUrl = ""
let suggestion = null
let scenarios = []
let selectedDemo = ""
let config = null
let busy = false
let original = false
let statusKey = "waiting"
let statusError = false
let requestController = null

function status(key, isError = false) {
  statusKey = key
  statusError = isError
  $("preview-status").textContent = key === "" ? "" : previewCopy(locale)[key] || previewCopy(locale).failed
  $("preview-status").classList.toggle("is-error", isError)
}

function render() {
  const t = previewCopy(locale)
  document.documentElement.lang = locale
  document.title = `ConstructAI Inspector · ${t.title}`
  document.querySelectorAll("[data-copy]").forEach(node => { node.textContent = t[node.dataset.copy] || "" })
  document.querySelectorAll("[data-copy-aria]").forEach(node => { node.setAttribute("aria-label", t[node.dataset.copyAria]) })
  $("preview-photo").alt = t.photoAlt
  document.querySelectorAll("[data-language]").forEach(node => {
    const active = node.dataset.language === locale
    node.classList.toggle("is-active", active)
    node.setAttribute("aria-pressed", String(active))
  })
  for (const key of ["live", "demo"]) {
    $(`mode-${key}`).classList.toggle("is-active", mode === key)
    $(`mode-${key}`).setAttribute("aria-pressed", String(mode === key))
  }
  $("live-controls").hidden = mode !== "live"
  $("demo-explanation").hidden = mode !== "demo"
  $("demo-section").hidden = mode !== "demo"
  $("empty-stage").hidden = Boolean(imageDataUrl)
  $("preview-photo").hidden = !imageDataUrl
  $("preview-stage").setAttribute("aria-busy", String(busy))
  $("analyze-button").disabled = busy || !imageDataUrl || !$("photo-consent").checked || !config?.liveConfigured
  $("clear-button").hidden = !imageDataUrl
  $("result-panel").hidden = !suggestion
  const mask = suggestion?.visualEvidence?.maskDataUrl
  $("preview-mask").hidden = !mask || original
  $("original-button").hidden = !mask
  $("original-button").textContent = original ? t.mask : t.original
  $("original-button").setAttribute("aria-pressed", String(original))
  $("result-origin").textContent = suggestion
    ? describePreviewResult(suggestion, locale).provenance : "SAM 3"
  if (suggestion) {
    const result = describePreviewResult(suggestion, locale)
    $("result-title").textContent = result.title
    $("model-score").textContent = result.score
    $("no-mask-note").hidden = Boolean(mask)
  }
  status(statusKey, statusError)
  for (const [index, button] of [...$("demo-list").children].entries()) {
    button.querySelector("span").textContent = `${t.example} ${String(index + 1).padStart(2, "0")}`
    button.setAttribute("aria-pressed", String(button.dataset.id === selectedDemo))
  }
}

function reset() {
  const revision = run.invalidate()
  requestController?.abort()
  requestController = null
  imageDataUrl = ""
  suggestion = null
  selectedDemo = ""
  busy = false
  original = false
  $("preview-photo").removeAttribute("src")
  $("preview-mask").removeAttribute("src")
  $("photo-consent").checked = false
  $("photo-file").value = ""
  return revision
}

function showImage(url, result = null) {
  imageDataUrl = url
  suggestion = result
  original = false
  $("preview-photo").src = url
  $("preview-mask").removeAttribute("src")
  const mask = result?.visualEvidence?.maskDataUrl
  if (mask && /^data:image\/png;base64,/.test(mask)) $("preview-mask").src = mask
  else if (result?.visualEvidence) suggestion = { ...result, visualEvidence: null }
}

async function preparePhoto(file) {
  if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("INVALID_IMAGE")
  if (file.size > 12 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE")
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try { await image.decode() } catch { throw new Error("INVALID_IMAGE") }
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 12_000_000) throw new Error("IMAGE_TOO_LARGE")
    const factor = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * factor))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * factor))
    const context = canvas.getContext("2d")
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [.88, .75, .6]) {
      const data = canvas.toDataURL("image/jpeg", quality)
      if (data.length < Math.floor(2 * 1024 * 1024 / 3) * 4) return data
    }
    throw new Error("IMAGE_TOO_LARGE")
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function loadPhotoFiles(files) {
  let file
  try { file = selectPhotoFile(files) } catch (error) { status(error.message, true); render(); return }
  const revision = reset()
  mode = "live"
  status("preparing")
  render()
  try {
    const data = await preparePhoto(file)
    if (!run.isCurrent(revision)) return
    showImage(data)
    status(config?.liveConfigured ? "ready" : "unavailable", !config?.liveConfigured)
  } catch (error) {
    if (!run.isCurrent(revision)) return
    status(error.message, true)
  }
  render()
}

$("photo-file").addEventListener("change", event => {
  if (event.target.files?.length) loadPhotoFiles(event.target.files)
})
guardFileNavigation(document)
bindPhotoDropZone($("preview-stage"), loadPhotoFiles, {
  onError: () => { status("INVALID_IMAGE", true); render() }
})

$("choose-button").addEventListener("click", () => $("photo-file").click())
$("photo-consent").addEventListener("change", render)
$("clear-button").addEventListener("click", () => { reset(); status("waiting"); render() })
$("original-button").addEventListener("click", () => { original = !original; render() })
for (const key of ["live", "demo"]) {
  $(`mode-${key}`).addEventListener("click", () => {
    if (mode === key) return
    reset()
    mode = key
    status(key === "demo" ? "selectDemo" : config?.liveConfigured ? "waiting" : "unavailable")
    render()
  })
}
document.querySelectorAll("[data-language]").forEach(button => {
  button.addEventListener("click", () => {
    locale = button.dataset.language === "ru" ? "ru" : "en"
    try { localStorage.setItem("constructai.preview.locale", locale) } catch { /* Storage is optional. */ }
    render()
  })
})

$("analyze-button").addEventListener("click", async () => {
  if (busy || !imageDataUrl || !$("photo-consent").checked || !config?.liveConfigured) return
  const revision = run.invalidate()
  const image = imageDataUrl
  const controller = new AbortController()
  requestController = controller
  const timeout = setTimeout(() => controller.abort(), 175_000)
  busy = true
  suggestion = null
  $("preview-mask").removeAttribute("src")
  status("pending")
  render()
  try {
    const response = await fetch("/api/preview/analyze", {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "omit",
      body: JSON.stringify({ imageDataUrl: image, consent: true }), signal: controller.signal
    })
    const result = await response.json()
    if (!run.isCurrent(revision)) return
    if (!response.ok) throw new Error(result.code || "LIVE_UNAVAILABLE")
    if (result.suggestion?.analysisMode !== "live" || result.suggestion.status !== "pending_review") throw new Error("INVALID_RESULT")
    showImage(image, result.suggestion)
    status("", false)
  } catch (error) {
    if (!run.isCurrent(revision)) return
    status(error.name === "AbortError" ? "ANALYSIS_TIMEOUT" : error.message, true)
  } finally {
    clearTimeout(timeout)
    if (run.isCurrent(revision)) {
      busy = false
      requestController = null
      render()
    }
  }
})

async function loadDemos() {
  try {
    const response = await fetch("/demo/scenarios.json", { credentials: "omit" })
    if (!response.ok) throw new Error("demoEmpty")
    const data = await response.json()
    scenarios = (data.scenarios || []).filter(item =>
      /^\/demo\/images\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/.test(item.imageUrl) && item.suggestion
    ).slice(0, 20)
    if (!scenarios.length) throw new Error("demoEmpty")
    scenarios.forEach(scenario => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "preview-demo-item"
      button.dataset.id = scenario.id
      const image = document.createElement("img")
      image.src = scenario.imageUrl
      image.alt = ""
      image.loading = "lazy"
      button.append(image, document.createElement("span"))
      button.addEventListener("click", () => {
        reset()
        selectedDemo = scenario.id
        showImage(scenario.imageUrl, demoPreview(scenario))
        status("")
        render()
      })
      $("demo-list").append(button)
    })
  } catch {
    const note = document.createElement("p")
    note.dataset.copy = "demoEmpty"
    $("demo-section").append(note)
  }
  render()
}

async function initialize() {
  render()
  try {
    const response = await fetch("/api/preview/config", { cache: "no-store", credentials: "omit" })
    if (!response.ok) throw new Error("unavailable")
    config = await response.json()
    if (!imageDataUrl && mode === "live") status(config.liveConfigured ? "waiting" : "unavailable", !config.liveConfigured)
  } catch { status("unavailable", true) }
  render()
}

$("preview-photo").addEventListener("error", () => { status("INVALID_IMAGE", true); render() })
$("preview-mask").addEventListener("error", () => {
  if (!suggestion) return
  suggestion = null
  $("preview-mask").removeAttribute("src")
  status("INVALID_RESULT", true)
  render()
})

initialize()
loadDemos()
