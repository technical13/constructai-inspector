import assert from "node:assert/strict"
import test from "node:test"
import { createDefectRecord, updateDefectRecord } from "../src/domain.js"
import { finalizeAiSuggestion } from "../src/inference.js"
import { buildReportSnapshot, renderReportHtml } from "../src/report.js"
import { getReviewDecision, transitionReviewDecision } from "../public/ai-review.js"

const photo = { id: "demo-photo", publicPath: "/demo/images/crack-demo-1.jpg", mimeType: "image/jpeg" }
const suggestion = {
  suggestionId: "suggestion-1",
  source: "grounded-sam2",
  modelKey: "grounded-sam2",
  modelLabel: "Grounded SAM 2",
  suggestedType: "crack",
  status: "accepted", // Old adapters cannot supply human consent.
  confidence: 0.4412345,
  analysisMode: "precomputed_demo",
  visualEvidence: {
    regions: [{ kind: "box", label: "Трещина", x: 0.2, y: 0.1, width: 0.2, height: 0.8 }]
  }
}
const input = { sessionId: "demo-session", defectType: "crack", comment: "Fictional demo observation.", aiSuggestion: suggestion }

test("A/B: explicit manual and accepted decisions are independent of matching types", () => {
  for (const decision of ["manual", "accepted", "pending_review"]) {
    const defect = createDefectRecord({ ...input, aiDecision: decision }, photo)
    assert.equal(getReviewDecision(defect.aiSuggestion), decision)
    assert.equal(defect.aiSuggestion.typeMatchesSuggestion, true)
    assert.equal(defect.aiSuggestion.confidence, 0.4412345)
  }
  const undecided = createDefectRecord(input, photo)
  assert.equal(getReviewDecision(undecided.aiSuggestion), "pending_review")
})

test("C: changing a type invalidates acceptance; returning to the model type needs a new decision", () => {
  const accepted = createDefectRecord({ ...input, aiDecision: "accepted" }, photo)
  const corrected = updateDefectRecord(accepted, { ...input, defectType: "spalling" })
  assert.equal(getReviewDecision(corrected.aiSuggestion), "corrected")
  assert.equal(corrected.aiSuggestion.finalType, "spalling")
  const returned = updateDefectRecord(corrected, input)
  assert.equal(getReviewDecision(returned.aiSuggestion), "pending_review")
  assert.equal(transitionReviewDecision("manual", "type_changed", "crack", "spalling"), "manual")
  assert.throws(() => createDefectRecord({ ...input, defectType: "spalling", aiDecision: "accepted" }, photo), /requires the suggested/)
})

test("D: a manual defect without AI has no fabricated confirmation", () => {
  const defect = createDefectRecord({ ...input, aiSuggestion: null }, photo)
  assert.equal(defect.aiSuggestion, null)
  assert.equal(getReviewDecision(defect.aiSuggestion), "manual_entry")
})

test("F/G: report uses the saved review, localizes vector text, and owns its snapshot", () => {
  const defect = createDefectRecord({ ...input, aiDecision: "manual" }, photo)
  const snapshot = buildReportSnapshot({
    project: { id: "demo-project", name: "Fictional demo project" },
    session: { id: input.sessionId, createdAt: "2026-10-17T00:00:00Z" },
    defects: [defect], reportLocale: "en"
  })
  defect.aiSuggestion.review.decision = "accepted"
  const html = renderReportHtml(snapshot)
  assert.match(html, /Manual selection/)
  assert.doesNotMatch(html, /AI accepted|Трещина/)
  assert.match(html, /AI suggested: Crack/)
  assert.match(html, /Model score: 44%/)
  assert.match(html, /previously generated segmentation mask/)
  assert.match(html, /not a structural safety assessment/)
  assert.match(html, /detection-overlay__region-label-text[^>]*>[\s\n]*Crack/)
})

test("H: a legacy accepted flag cannot prove a human action; reading does not rewrite it", () => {
  const legacy = { ...suggestion, finalType: "crack" }
  delete legacy.suggestionId
  const before = JSON.stringify(legacy)
  assert.equal(getReviewDecision(legacy), "legacy_unverified")
  const defect = { ...input, aiSuggestion: legacy, photos: [photo], createdAt: "2026-10-17T00:00:00Z" }
  const updated = updateDefectRecord(defect, input)
  assert.equal(JSON.stringify(updated.aiSuggestion), before)
  assert.equal(legacy.status, "accepted")
})

test("I: a new suggestion is pending and stale review requests are rejected", () => {
  const accepted = createDefectRecord({ ...input, aiDecision: "accepted" }, photo)
  const reanalysed = { ...accepted, aiSuggestion: finalizeAiSuggestion({ ...suggestion, suggestionId: "new-suggestion" }, "crack") }
  assert.equal(getReviewDecision(reanalysed.aiSuggestion), "pending_review")
  assert.throws(() => updateDefectRecord(reanalysed, {
    ...input, aiDecision: "accepted", reviewSuggestionId: "suggestion-1"
  }), /suggestion changed/)
})
