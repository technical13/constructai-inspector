import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { promises as fs } from "node:fs"
import test from "node:test"
import { finalizeAiSuggestion, getCvModels, suggestDefectFromImage } from "../src/inference.js"
import { getCvModelUrl, getDefaultCvModelKey } from "../src/runtime-config.js"
import { demoPreview, describePreviewResult } from "../public/preview-contract.js"
import { getAnalysisLabel } from "../public/ai-review.js"

test("SAM 2 is retired for execution but saved provenance is preserved", async () => {
  assert.ok(!getCvModels().some(model => model.key === "grounded-sam2"))
  assert.equal(getCvModelUrl("grounded-sam2"), "")
  await assert.rejects(suggestDefectFromImage("data:image/png;base64,YQ==", undefined, { modelKey: "grounded-sam2" }), error => error.statusCode === 400)
  const original = { modelKey: "grounded-sam2", modelLabel: "Grounded SAM 2", modelVersion: "historical-version", suggestedType: "crack", confidence: .42 }
  const saved = finalizeAiSuggestion(original, "crack", undefined, { decision: "manual" })
  assert.equal(saved.modelKey, original.modelKey)
  assert.equal(saved.modelLabel, original.modelLabel)
  assert.equal(saved.modelVersion, original.modelVersion)
  assert.equal(saved.review.decision, "manual")
  const demo = demoPreview({ suggestion: original })
  assert.match(describePreviewResult(demo, "en").provenance, /Precomputed demo.*Grounded SAM 2/)
  assert.equal(original.modelKey, "grounded-sam2")
})

test("obsolete default selection falls back to SAM 3 without aliasing requests", () => {
  const previous = process.env.CV_MODEL_DEFAULT
  try {
    process.env.CV_MODEL_DEFAULT = "grounded-sam2"
    assert.equal(getDefaultCvModelKey(), "sam3")
  } finally {
    if (previous === undefined) delete process.env.CV_MODEL_DEFAULT
    else process.env.CV_MODEL_DEFAULT = previous
  }
})

test("cloud package contains only SAM 3 code and no model weights or runtime data", async () => {
  const packaged = JSON.parse(execFileSync(process.execPath, ["scripts/package-hf-space.mjs"], { encoding: "utf8" }))
  try {
    const paths = packaged.files.map(file => file.path)
    assert.ok(paths.includes("services/cv_inference/sam3_service.py"))
    assert.ok(paths.includes("services/cv_inference/sam3-model.json"))
    assert.ok(paths.every(path => !/deepcrack|sam2|\.safetensors|\.pth|\.env|data\//i.test(path)))
    const space = await fs.readFile(`${packaged.output}/app.py`, "utf8")
    assert.doesNotMatch(space, /deepcrack_service|grounded_sam2|Sam2Model/)
    assert.match(space, /sam3_service\.ensure_loaded/)
    assert.deepEqual(
      JSON.parse(await fs.readFile(`${packaged.output}/models.json`, "utf8")),
      JSON.parse(await fs.readFile(`${packaged.output}/services/cv_inference/sam3-model.json`, "utf8"))
    )
    assert.ok(packaged.files.reduce((sum, file) => sum + file.bytes, 0) < 100_000)
  } finally {
    await fs.rm(packaged.output, { recursive: true, force: true })
  }
})

test("SAM 2 runtime classes and model imports are absent", async () => {
  const source = await fs.readFile(new URL("../services/cv_inference/app.py", import.meta.url), "utf8")
  assert.doesNotMatch(source, /GroundedSam2Service|Sam2Model|Sam2Processor|SAM2_|sample_seed_points/)
})

test("live, precomputed and legacy provenance remain distinct in UI and reports", () => {
  assert.equal(getAnalysisLabel({ analysisMode: "live" }, "en"), "Live inference result")
  assert.match(getAnalysisLabel({ analysisMode: "precomputed_demo" }, "en"), /Precomputed/)
  assert.match(getAnalysisLabel({}, "en"), /Saved model output/)
  assert.match(getAnalysisLabel({ analysisMode: "mock" }, "en"), /Mock/)
})

test("new photos run one selected adapter, with comparisons requested on demand", async () => {
  const source = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8")
  assert.match(source, /api\("\/api\/ai\/suggest"/)
  assert.doesNotMatch(source, /api\("\/api\/ai\/compare"/)
  assert.match(source, /preserveResults: true/)
  assert.match(source, /modelKey: selectedModel\.key/)
  assert.match(source, /item\.suggestion\.analysisMode !== "precomputed_demo"/)
})
