# Remediation And Evidence Readiness - 2026-10-17

Overall status: **PARTIALLY READY**. The review defect is fixed and verified.
The final evidence run has two original screenshots; automatic approval review
blocked creation of the fictional session needed for frames 03-08. Manual
continuation instructions are available. Production has not been changed.

Code commit: `26b5befe8d2d3dc3fdcc5ed9d6e048ad337bae4a`.
Local branch: `fix/explicit-ai-review-evidence`. No push or deployment performed.
Risk classification: `HIGH`.

## A. Root Cause Analysis

- Keep manual only moved focus to a select; it never recorded an operator decision.
- The finalizer equated suggested/final type equality with acceptance. Saving and
  reanalysis therefore created confirmations without an Accept action.
- Saved type edits preserved stale AI metadata. The PostgreSQL UPDATE also did
  not persist any changed suggestion JSON.
- Report SVG labels used raw Russian region text despite the English locale.
  The reviewed demo raster contains no text; it was not modified.
- Minimum photo heights and cover fitting could crop images independently from
  normalized overlays. Model scores had no explicit model-score label.

## B. Implemented Fixes

- `public/ai-review.js`: shared pure decision transitions, labels, source/mode
  disclosure, score wording, and localized region labels.
- `src/domain.js`, `src/inference.js`: explicit review validation, stable suggestion
  identity, independent type-match flag, pending reanalysis, and legacy read policy.
- `src/local-store.js`, `src/postgres-store.js`: same domain contract for both
  backends; Postgres persists review JSON and rejects edits/reanalysis that race
  with another write. No column/data migration was required.
- `public/app.js`, `public/index.html`: actionable Accept/Keep manual controls,
  pressed-state feedback, decision indicator, review of saved records, translated
  accessibility labels and runtime errors, explicit precomputed demo disclosure.
- `src/report.js`: localized vector labels, saved review/provenance, source score,
  independent snapshot copy, and image/mask geometry parity.
- `public/app.css`: restrained wide-screen split, wrapping/min-width fixes and
  natural image ratios. Existing Braun visual language retained.
- `scripts/evidence-*.mjs`, `src/paths.js`: fresh local storage and non-overwriting
  screenshot manifest tooling. No mandatory dependencies were added.

## C. State Consistency

New records use `review = { version: 1, decision, reviewedAt }` inside existing
`aiSuggestion` JSON. `status` mirrors this value for compatibility.

| Saved decision | Meaning |
| --- | --- |
| `accepted` | Explicit Accept type action, final type matches suggestion. |
| `corrected` | Operator changed the type away from the suggested type. |
| `manual` | Keep manual, including coincidentally matching types. |
| `pending_review` | No decision for the current suggestion. |
| No suggestion | Manual entry. |

Type edits invalidate acceptance; manual stays manual. Reanalysis replaces the
suggestion identity and starts pending. Saved review commands must identify the
current suggestion; stale commands return 409. Old flags without a versioned
review display as Review not recorded (legacy), without changing their bytes.
Historical reports are not regenerated. New reports use saved snapshots only.

## D. Localization

Programmatic `Трещина` labels are translated to `Crack` in English vector
overlays. Redundant labels on mask mode are suppressed consistently with the UI.
Original photos and numeric scores are unchanged. User-authored data is not
silently translated. Review states, demo disclosure, score explanations and new
service errors have Russian/English presentation. A score is not claimed to be
calibrated probability, validated accuracy, precision or recall.

## E. Tests

**READY**: full `npm run verify` on Node 24.22.0, 34/34 Node tests and 8/8 Python
contracts. No failures or skips in the Postgres-enabled run.

- A/B/C/D: manual, explicit acceptance, correction, unavailable inference/manual entry.
- E/F: real HTTP save/reload and report snapshot/status/byte immutability.
- G/H/I: English SVG text, safe legacy reading, fresh/stale reanalysis review.
- J: identical API suite on filesystem and actual disposable PostgreSQL 16.
- Extra: Postgres inference/edit race returns 409 and preserves the edit.

The CV endpoint in tests is a deterministic mock, not heavy live inference.
Postgres tests reject non-local hosts and non-test database names. The temporary
test database was independent of Neon. Audit retains the pre-existing warning
about three orphan local uploads; none were removed.

Rehearsal in Chrome verified matching Crack + Keep manual -> saved Manual
selection. Layout width checks at 390, 768, 1440 px found no horizontal page
overflow in the inspected states. This is not an exhaustive device certification;
the full final report/responsive screenshot sequence remains incomplete.

## F. Screenshot Evidence

**PARTIALLY READY**: actual raw browser screenshots, October 17, 2026:

- `01-project-setup.png`: 1440 x 1179, fictional project form.
- `02-inspection-session.png`: 1440 x 935, fictional session form.

Local artifact directory:
`logs/evidence-2026-10-17T13-10-54-172Z/`.

The directory includes `browser-environment.json`, `capture-notes.md`,
`verify-node24.log`, and `sha256-manifest.json`. The manifest records the code SHA
above and a clean worktree at capture. PNGs were visually inspected after saving
their original browser bytes, with no editing, montage or retouching.

Chrome 155, English UI, 1440 x 900 viewport, DPR 1, Asia/Novosibirsk,
reduced motion enabled. Full-page originals extend vertically beyond the viewport.
Existing evidence archives were not overwritten. No external uploads occurred.

**Not obtained in this final run:** 03 Demo Mode, 04 AI Suggestion, 05 Human Review,
06 Saved Defect, 07 Generated Report, 08 HTML Report. Automatic approval review
twice rejected the Open session click and explicitly required renewed user
authorization despite confirming the fictional data and local-only storage.
Do not substitute a mock image or claim these frames exist.

Continuation: `docs/evidence-capture.md`. Any later captures need their own
non-overwriting manifest; preserve the existing two original files and manifest.

## G. Remaining Limitations

- Historical human intent cannot be recovered from old inferred flags.
- Public demo uses precomputed results. Live inference quality was not assessed
  in this remediation; the existing model-output benchmark is not independent
  accuracy evidence.
- The prototype still has its documented limitations, including no enterprise
  authentication/authorization and restricted external-Blob reanalysis.
- Wide-screen functional checks passed for the inspected states, while the full
  final screenshot/report sequence is awaiting authorization or manual capture.

## H. Deployment Status

**PARTIALLY READY**: fixes are local and versioned. Public Vercel still runs its
previous version. Production Postgres, existing records and historical documents
were not changed. There is no destructive migration to roll back.

After separate authorization: review the local commits, push/publish the chosen
revision, deploy via the existing Vercel workflow, and perform read-only checks
of demo provenance and the current UI. Any new write-based public smoke test
needs explicit scope. Do not infer that local screenshots prove a public deploy.

## I. Exhibit E-9 Technical Readiness

**PARTIALLY READY**. The state/persistence/report implementation is **READY** under
the stated tests. The complete screenshot package and updated public deployment
are pending. No unresolved critical review-state defect was found after testing.
This is a technical assessment of prototype evidence, not a legal conclusion
about USCIS eligibility or evidentiary sufficiency.

Scores (1-5): stability 4; risk surface 4; invariant confidence 5; test confidence 4.

Remaining actions: authorize or manually finish frames 03-08, check the resulting
English HTML and responsive views, create the continuation hash manifest, and
separately authorize publication if the public URL must show the fix.
