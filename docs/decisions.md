# Decisions

## 2026-04-16 — Engineering OS retrofit over existing runtime

- Context: the late prompt assumes a fresh bootstrap with a controlled preset stack.
- Decision: preserve the current working repository and apply the OS as a governance layer instead of rewriting the runtime.
- Rationale: destructive stack replacement would invalidate working UI, storage, report, and inference paths without product need.
- Consequence: preset logic is recorded as reference only; repository safety wins over prompt literalism.

## 2026-04-16 — Stack selection record

- Prompt default: `PRESET 1` because the project has browser UI.
- Effective repository stack: existing mobile-first browser UI + Node.js ESM server + local/Postgres persistence + optional Python CV service.
- Rationale: the current runtime is already working and aligned with the Project Brief.

## 2026-04-16 — Verification baseline

- Decision: add deterministic `lint`, `typecheck`, `build`, and `verify` commands without introducing heavy new dependencies.
- Rationale: the repository needs enforceable checks now, not theoretical future tooling.

## 2026-04-16 — Report snapshot preservation

- Decision: deletion of a live defect must not invalidate already generated reports.
- Rationale: reports are historical snapshots, not live views.

## 2026-07-13 — Historical media identity

- Decision: report snapshots retain photo identity fields, while local media lookup continues to resolve older snapshots from their public paths.
- Rationale: historical reports must keep loading photos after the live defect is removed.

## 2026-07-13 — Public demo is read-only

- Decision: demo save/delete APIs and controls are enabled only when `DEMO_LIBRARY_WRITABLE` permits it; Vercel defaults to read-only.
- Rationale: checked-in demo fixtures cannot be persistently mutated in serverless runtime and public viewers must not receive misleading controls.
