# Regression Memory

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
