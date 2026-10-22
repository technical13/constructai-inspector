# Regression Memory

## SAM 3 Primary Migration (2026-10-21)

- Transformers 5.5.4 leaves zero-instance masks at decoder dimensions even with
  target sizes. Zero instances must stay empty, not fail geometry validation or
  be replaced by a precomputed mask. Nonempty geometry mismatches still fail.
- Postprocess instances individually to avoid N full-resolution int64 masks.
  Bound candidate count and fail explicitly rather than silently losing regions.
- Active model selection and persisted provenance are different contracts.
  Retired SAM 2 keys must remain readable without becoming SAM 3 keys on save.
- Public inference verifies SAM 3 identity/revision/hash in addition to image
  provenance. Old hosted responses must fail closed during a partial cutover.
- A local HF login does not configure a Space secret. Never copy gated weights
  or a local token into the public deployment package.
- Starting a live comparison from a demo image clears demo-mode state and drops
  precomputed comparison entries. A saved demo must not become a live result by
  changing the selector, and a retired demo key must not become an active model.

## Public Preview Boundary (2026-10-20)

- Vercel's static `index.html` wins over a root rewrite in this Other-framework
  deployment. Use an explicit root redirect to `/try`, not just a rewrite, and
  verify the deployed root rather than relying on local routing tests.
- Vercel must deny workspace API reads as well as writes, even if an environment
  variable tries to disable public mode. Never call bootstrap/store/schema setup
  as a health check in public mode.
- Image input consent, raster/base64/body caps, actual input hash and mask size
  checks are independent of UI validation. Error text from providers is private.
- Quota denial can arrive as an SSE error after successful job submission; map
  it to a visible error, not a demo mask or an automatic retry.
- Changing photo/mode invalidates pending results; a canceled browser request
  cannot promise cancellation of an already submitted GPU job.
- Demo fixtures can contain legacy accepted flags and Russian text. Public DTOs
  reset review to pending; the bilingual UI uses its own localized provisional
  labels rather than displaying stored localized rationale/type strings.

## ZeroGPU Boundary (2026-10-20)

- A Mac-only device selector ignored NVIDIA GPUs; CUDA is now preferred when
  available, while explicit device selection supports ZeroGPU startup emulation.
- ZeroGPU requires Gradio-mediated jobs and startup model placement; a raw `/infer`
  REST request is not a replacement for its queued GPU allocation protocol.
- Gradio error/heartbeat/EOF events must never be interpreted as successful model
  output. A new attempt must not silently consume more GPU quota via retries.
- Keep packaged files allowlisted and model revisions pinned. No runtime project
  data, credentials, or historical evidence may be included in a public Space.
- The Gradio builder mounts only the root requirements file under `/tmp` before
  copying app source. Nested `-r services/...` includes fail there. Keep the Space
  requirements self-contained; a regression test checks parity with CV pins.
- The builder injects Gradio's `mcp,oauth` extras even when the app does not enable
  those features. Gradio 6.30.0's MCP extra requires Pydantic <=2.12.5. Keep the
  explicitly documented Space-only pin; do not downgrade the local CV environment.

## Known Fragile Zones

- UI overlay rendering versus report overlay rendering parity
- local storage versus Postgres storage behavior parity
- report/media access after defect deletion
- CV post-processing that can turn noisy masks into misleading boxes
- session state restoration from local storage in the browser

## Historical Bug Surfaces

- old reports preserving obsolete styling after UI redesign
- raw CV masks producing visually noisy or misleading overlays
- large merged AI zones swallowing non-defect image areas
- missing edit/delete controls for saved defects

## Performance-Sensitive Areas

- image data URL handling in browser memory
- report rendering with many embedded photos
- connected-component extraction in Python post-processing

## Areas Requiring Stricter Tests

- defect edit/delete behavior against existing reports
- old snapshot compatibility after UI/report refactors
- inference fallback behavior when external CV is unavailable
- timeout and queue semantics across Node gateway and Python registry
- benchmark reference provenance and duplicate-case detection

## Previous Schema Risks

- `aiSuggestion.visualEvidence` shape changes
- media location differences across local/Postgres/Vercel modes

## Update Rule

Whenever a regression is found or a fragile area is touched, append a dated note to this file and the stability log.

## 2026-07-13 Maintenance Audit

- Historical report snapshots omitted `photo.id` and `photo.fileName`; deleting a live defect could make report media unavailable in local mode. New snapshots preserve media identity and legacy public paths are resolved compatibly.
- Legacy CV adapters used `void` while the domain catalog uses `honeycombing`; all incoming legacy values are now normalized before review or persistence.
- Demo-library write controls must stay hidden and API mutations blocked on read-only public deployments.
- Three local upload files are currently unreferenced. They remain untouched pending explicit user approval for destructive cleanup.
- Git metadata was subsequently restored; repository-aware audits are available again.

## 2026-07-15 Bounded Inference And Benchmark

- Parallel comparison previously fanned all configured models into one local ML endpoint without a deadline or concurrency bound.
- DeepCrack checkpoint loading previously occurred during module import and could prevent independent adapters from starting.
- The initial benchmark candidate set contained two byte-identical demo images; duplicate-content detection now rejects this condition.
- Curated model masks are regression references only. They are explicitly ineligible for accuracy claims until independent human annotations exist.

## 2026-07-15 Vercel Deployment

- Vercel CLI included 703 MB of local environments, model weights, and runtime data until an explicit `.vercelignore` was added. Deployment input must remain small and free of local data.
- A Vercel runtime without an explicit CV endpoint previously inherited `127.0.0.1:8001` and advertised models as configured. Loopback defaults are now local-only.
- Locally added demo scenarios may contain only Russian source text. English UI must derive deterministic localized demo metadata and comments instead of leaking Russian fallback text.
- Production smoke tests must clean up temporary Postgres projects and sessions after asserting write/read behavior.

## 2026-10-17 Human Review Remediation

- Keep manual previously only focused the select. The server inferred acceptance from type equality, including after reanalysis. New review metadata is explicit and defaults to pending.
- Saved type edits previously retained stale suggestion final types/statuses; Postgres also omitted updated suggestion JSON from its UPDATE. Both adapters now use the shared domain mutation.
- Legacy accepted/corrected flags cannot establish a real click. Preserve old bytes and label their decision as unrecorded in current views/new reports.
- Report SVG labels previously retained Russian `Трещина` in EN and rendered a label even on mask mode. UI/report now share localized labels; masks have no redundant region label.
- `object-fit: cover` plus a minimum photo height could crop a photo independently of its SVG. Evidence photos now retain their natural ratio.
- Reanalysis must not overwrite a concurrent edit in Postgres. A guarded UPDATE returns 409 and leaves the edited record intact.
- Evidence capture uses `CONSTRUCTAI_DATA_DIR` and disabled inference. Never substitute generated screenshots or modify original evidence files.
- Saved-thumbnail model/decision badges overlapped at tablet widths. Keep the model tag on the photo and the dedicated decision indicator beside it; check layout after two animation frames when changing emulated viewports.
