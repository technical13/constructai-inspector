import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { selectPhotoFile, bindPhotoDropZone, guardFileNavigation, MAX_PHOTO_BYTES } from "../public/photo-input.js"
import { previewCopy } from "../public/preview-contract.js"

const photo = { name: "crack.jpg", type: "image/jpeg", size: 100 }

test("verification discovers only current source tests, not archived deployment copies", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
  assert.equal(pkg.scripts["test:node"], "CV_INFERENCE_MODE=mock node --test test/*.test.js")
})

class Target extends EventTarget {
  classes = new Set()
  classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) }
}

function drag(type, files = [photo], types = ["Files"]) {
  const event = new Event(type, { cancelable: true })
  Object.defineProperty(event, "dataTransfer", { value: { types, files, dropEffect: "none" } })
  return event
}

test("picker and drop share single-photo, format, empty-file and byte limits", () => {
  assert.equal(selectPhotoFile([photo]), photo)
  for (const type of ["image/png", "image/webp"]) assert.equal(selectPhotoFile([{ ...photo, type }]).type, type)
  for (const files of [[], [null], [{ ...photo, type: "image/svg+xml" }], [{ ...photo, type: "text/html" }], [{ ...photo, size: 0 }]]) {
    assert.throws(() => selectPhotoFile(files), /INVALID_IMAGE/)
  }
  assert.throws(() => selectPhotoFile([photo, photo]), /ONE_PHOTO_ONLY/)
  assert.throws(() => selectPhotoFile([{ ...photo, size: MAX_PHOTO_BYTES + 1 }]), /IMAGE_TOO_LARGE/)
  assert.equal(selectPhotoFile([{ ...photo, size: MAX_PHOTO_BYTES }]).size, MAX_PHOTO_BYTES)
  for (const locale of ["en", "ru"]) assert.ok(previewCopy(locale).ONE_PHOTO_ONLY)
})

test("drop depth survives nested children and submits only once; blur/drop clears feedback", async () => {
  const zone = new Target()
  const window = new Target()
  const selected = []
  const remove = bindPhotoDropZone(zone, files => selected.push(selectPhotoFile(files)), { blurTarget: window })
  zone.dispatchEvent(drag("dragenter"))
  zone.dispatchEvent(drag("dragenter"))
  zone.dispatchEvent(drag("dragleave"))
  assert.equal(zone.classes.has("is-drag-over"), true)
  const over = drag("dragover")
  zone.dispatchEvent(over)
  assert.equal(over.defaultPrevented, true)
  assert.equal(over.dataTransfer.dropEffect, "copy")
  const drop = drag("drop")
  zone.dispatchEvent(drop)
  await Promise.resolve()
  assert.equal(drop.defaultPrevented, true)
  assert.deepEqual(selected, [photo])
  assert.equal(zone.classes.size, 0)
  zone.dispatchEvent(drag("dragenter"))
  window.dispatchEvent(new Event("blur"))
  assert.equal(zone.classes.size, 0)
  remove()
  zone.dispatchEvent(drag("drop"))
  await Promise.resolve()
  assert.equal(selected.length, 1)
})

test("disabled zones do not load files; dragged URLs never become fetched photos", async () => {
  const zone = new Target()
  const errors = []
  let calls = 0
  let enabled = false
  bindPhotoDropZone(zone, files => { calls++; return selectPhotoFile(files) }, {
    enabled: () => enabled, onError: error => errors.push(error.message), blurTarget: null
  })
  zone.dispatchEvent(drag("drop"))
  await Promise.resolve()
  assert.equal(calls, 0)
  enabled = true
  zone.dispatchEvent(drag("dragenter", [], ["text/uri-list"]))
  assert.equal(zone.classes.size, 0)
  zone.dispatchEvent(drag("drop", [], ["text/uri-list"]))
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(errors, ["INVALID_IMAGE"])
})

test("file drops outside the target cannot navigate away and do not start uploads", () => {
  const doc = new Target()
  const remove = guardFileNavigation(doc)
  const drop = drag("drop")
  doc.dispatchEvent(drop)
  assert.equal(drop.defaultPrevented, true)
  const text = drag("dragover", [], ["text/plain"])
  doc.dispatchEvent(text)
  assert.equal(text.defaultPrevented, false)
  remove()
  const next = drag("drop")
  doc.dispatchEvent(next)
  assert.equal(next.defaultPrevented, false)
})

test("both UIs use the same file path; public drops reset consent without starting inference", async () => {
  const preview = await readFile(new URL("../public/preview.js", import.meta.url), "utf8")
  const workspace = await readFile(new URL("../public/app.js", import.meta.url), "utf8")
  assert.match(preview, /const revision = reset\(\)\s+mode = "live"/)
  assert.match(preview, /bindPhotoDropZone\(\$\("preview-stage"\), loadPhotoFiles/)
  assert.match(preview, /photo-consent"\)\.checked = false/)
  assert.match(workspace, /bindPhotoDropZone\(document\.querySelector\("#capture-drop-zone"\), loadPhotoFiles/)
  assert.match(workspace, /if \(requestId !== state\.suggestionRequestId\) return\s+setPhotoPreview\(dataUrl\)/)
})
