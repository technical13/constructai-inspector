import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { demoPreview, describePreviewResult } from "../public/preview-contract.js"
import modelLock from "../services/cv_inference/sam3-model.json" with { type: "json" }

test("current demos contain new pinned SAM 3 masks with exact source hashes and pending review", async () => {
  const document = JSON.parse(await readFile(new URL("../public/demo/scenarios.json", import.meta.url), "utf8"))
  assert.equal(document.scenarios.length, 4)
  assert.equal(new Set(document.scenarios.map(s => s.id)).size, 4)
  for (const scenario of document.scenarios) {
    const s = scenario.suggestion
    assert.equal(s.modelKey, "sam3")
    assert.equal(s.modelLabel, "SAM 3")
    assert.equal(s.source, "sam3")
    assert.equal(s.modelVersion, `${modelLock.sam3.id}@${modelLock.sam3.revision}`)
    assert.equal(s.analysisMode, "precomputed_demo")
    assert.equal(s.status, "pending_review")
    assert.deepEqual(s.review, { version: 1, decision: "pending_review", reviewedAt: null })
    assert.equal(s.finalType, undefined)
    assert.equal(s.reviewedAt, undefined)
    assert.equal(s.suggestedType, "crack")
    assert.ok(Number.isFinite(s.confidence) && s.confidence > 0 && s.confidence <= 1)
    assert.ok(s.confidence.toString().length > 5, "native score is not replaced by a rounded display score")
    assert.deepEqual(s.inferenceProvenance.models, modelLock)
    assert.equal(s.inferenceProvenance.host, "local-cpu")
    const input = await readFile(new URL(`../public${scenario.imageUrl}`, import.meta.url))
    assert.equal(createHash("sha256").update(input).digest("hex"), s.inferenceProvenance.inputSha256)
    const mask = Buffer.from(s.visualEvidence.maskDataUrl.split(",")[1], "base64")
    assert.equal(mask.subarray(0, 8).toString("hex"), "89504e470d0a1a0a")
    assert.equal(mask.readUInt32BE(16), s.inferenceProvenance.inferenceSize.width)
    assert.equal(mask.readUInt32BE(20), s.inferenceProvenance.inferenceSize.height)
    assert.equal(mask.readUInt32BE(16), s.visualEvidence.maskWidth)
    assert.equal(mask.readUInt32BE(20), s.visualEvidence.maskHeight)
    assert.ok(s.evidence.positivePixels > 0)
    assert.ok(s.visualEvidence.regions.length > 0)
    assert.match(describePreviewResult(demoPreview(scenario), "en").provenance, /Precomputed demo.*SAM 3/)
    assert.ok(scenario.descriptionEn && scenario.titleEn && scenario.commentEn)
  }
})
