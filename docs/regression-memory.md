# Regression Memory

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
