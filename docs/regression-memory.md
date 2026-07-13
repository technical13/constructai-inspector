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
- Git metadata is absent from the current workspace copy, so history and tracked-file audits are unavailable.
