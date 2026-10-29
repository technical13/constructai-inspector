export const MAX_PHOTO_BYTES = 12 * 1024 * 1024

export function selectPhotoFile(files) {
  if (!files?.length) throw new Error("INVALID_IMAGE")
  if (files.length !== 1) throw new Error("ONE_PHOTO_ONLY")
  const file = files[0]
  if (!["image/jpeg", "image/png", "image/webp"].includes(file?.type) || !Number.isFinite(file?.size) || file.size <= 0) {
    throw new Error("INVALID_IMAGE")
  }
  if (file.size > MAX_PHOTO_BYTES) throw new Error("IMAGE_TOO_LARGE")
  return file
}

function hasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes("Files")
}

export function guardFileNavigation(target) {
  const prevent = event => { if (hasFiles(event)) event.preventDefault() }
  target.addEventListener("dragover", prevent)
  target.addEventListener("drop", prevent)
  return () => {
    target.removeEventListener("dragover", prevent)
    target.removeEventListener("drop", prevent)
  }
}

export function bindPhotoDropZone(element, onFiles, { enabled = () => true, onError = () => {}, blurTarget = globalThis.window } = {}) {
  let depth = 0
  const clear = () => { depth = 0; element.classList.remove("is-drag-over") }
  const enter = event => {
    if (!hasFiles(event) || !enabled()) return
    event.preventDefault()
    depth += 1
    element.classList.add("is-drag-over")
  }
  const over = event => {
    if (!hasFiles(event) || !enabled()) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }
  const leave = () => {
    depth = Math.max(0, depth - 1)
    if (!depth) clear()
  }
  const drop = event => {
    event.preventDefault()
    event.stopPropagation()
    clear()
    if (!enabled()) return
    // Only local files enter the shared picker path; never fetch dragged URLs/HTML.
    Promise.resolve().then(() => onFiles(event.dataTransfer?.files || [])).catch(onError)
  }
  const handlers = { dragenter: enter, dragover: over, dragleave: leave, drop, dragend: clear }
  for (const [name, handler] of Object.entries(handlers)) element.addEventListener(name, handler)
  blurTarget?.addEventListener("blur", clear)
  return () => {
    clear()
    for (const [name, handler] of Object.entries(handlers)) element.removeEventListener(name, handler)
    blurTarget?.removeEventListener("blur", clear)
  }
}
