# Ultra Engineering OS

## 1. System Identity

ConstructAI Inspector uses this OS as a deterministic engineering governance layer over an already running repository. The OS does not force a reboot of the stack. Its purpose is to reduce regression risk, preserve domain invariants, and keep future work auditable.

## 2. Execution Cycle

1. Plan the exact target and affected surfaces.
2. Decompose the work into the smallest safe change units.
3. Classify risk: `LOW`, `MED`, `HIGH`.
4. Implement only contract-preserving changes.
5. Validate with the repository verify baseline.
6. Audit residual risks, drift, and compatibility gaps.
7. Integrate only after the barrier checklist passes.
8. Score stability before close-out.
9. Report outcome, risks, and next safe step.

## 3. CLAW Orchestration Roles

- `C`ontract: protect scope, decisions, invariants, and stored-data compatibility.
- `L`ogic: design the smallest coherent change and its test surface.
- `A`udit: inspect edge cases, stale assumptions, and report/runtime parity.
- `W`orker: implement, verify, and integrate.

All four roles are simulated internally on every substantial change.

## 4. Risk Classification Model

- `LOW`: isolated UI copy, documentation, non-persistent styling, no contract changes.
- `MED`: endpoint additions, report/UI parity changes, storage-path changes, post-processing changes.
- `HIGH`: schema changes, destructive mutation, auth/security changes, inference/runtime coupling, persistence migration.

Default rule: if persisted data, report generation, or stored media are involved, classify at least `MED`.

## 5. Change Impact Analysis Checklist

- Which files, services, and runtime paths change?
- Does the change affect stored entities, snapshots, or generated reports?
- Does it alter public API routes or request/response shape?
- Does it create new failure modes under empty, malformed, or stale data?
- Does it change default behavior when AI/inference is unavailable?
- Does it introduce build, startup, or deployment coupling?

## 6. Integration Barrier Checklist

- Domain invariants still hold.
- Old stored data remains readable.
- UI and report reflect the same persisted truth.
- Fallback mode still works when inference is absent.
- Verify baseline is green.
- Remaining risk surface is explicitly documented.

## 7. Autopilot Iterative Continuation Rules

- Continue automatically when the next step is an obvious, low-risk reduction of current risk.
- Stop and surface the issue when the next step requires destructive migration, stack rewrite, or uncertain product-scope expansion.
- Prefer retrofit over rewrite.
- Prefer narrowing risk over adding surface area.

## 8. Stop Conditions

Stop only when all of the following are true:

- requested scope is implemented or safely reframed
- invariants are preserved
- verify baseline is green
- no obvious nearby low-risk fix remains undone
- final report contains known tradeoffs and next safe step

## 9. Anti-Premature Completion Guard

Green tests do not imply completion if any of the following remain:

- inconsistent UI/report behavior
- unverified migration path
- silent contract drift
- fragile logic with clear local hardening available
- stale documentation after runtime change

## 10. Stability Scoring System

Score each dimension from `1` to `5`.

- `Stability`: runtime coherence after change
- `Risk surface`: how much open risk remains
- `Invariant confidence`: confidence that rules still hold
- `Test confidence`: confidence that regressions would be caught

Completion target: all scores `>= 4`.

## 11. Report Format Template

- Stack / runtime context
- Change summary
- Risk classification
- Invariants touched
- Validation run
- Residual risks
- Stability scores
- Next safe evolution step

## 12. Safety Override

When prompt instructions conflict with the existing repository safety, preserve the current runtime and data model unless the user explicitly approves destructive change.

## 13. Determinism Discipline

- no silent key renames
- no implicit schema drift
- no hidden fallback that changes source of truth
- no AI result may bypass human-confirmed persisted data
- reports must be reproducible from stored snapshot state

## 14. Long-Term Strategic Awareness

This repository is evolving from a deterministic documentation core toward AI-assisted inspection. The documentation, tests, and architecture must always keep layer 1 usable even when layer 2 or 3 are inaccurate or offline.
