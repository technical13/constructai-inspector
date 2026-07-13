# Invariants

## Core Domain Invariants

1. Every `Defect` belongs to exactly one existing `Session`.
2. Every `Session` belongs to exactly one existing `Project`.
3. Every saved `Defect` has at least one persisted photo.
4. A `Report` contains only defects from its own session snapshot.
5. A `Report` is reproducible from stored snapshot data without consulting live UI state.
6. `aiSuggestion` may influence operator workflow but may not silently overwrite human-confirmed persisted truth.
7. `visualEvidence` is optional metadata; absence of CV data must not block the deterministic workflow.

## State Mutation Discipline

- create entities only through domain constructors
- update persisted entities through explicit mutation functions
- keep mutation fields explicit and minimal
- preserve untouched fields when updating records

## Schema Migration Rules

- no destructive schema change without a migration plan
- no silent field deletion
- no implicit reinterpretation of stored JSON
- new optional fields must be backward-readable

## Naming Discipline

- no silent key renames
- no dual keys for the same meaning without a compatibility layer
- if a key must change, document the migration in `docs/decisions.md` and `docs/regression-memory.md`

## Deterministic State Transitions

- `pending_review -> accepted|corrected` is explicit
- defect save is explicit
- report generation is explicit
- deletion is explicit and must not mutate already stored report snapshots

## Invariant Violation

The task is invalid if it:

- makes old persisted data unreadable
- allows a report to diverge from stored snapshot truth
- allows a defect without a photo
- silently changes public route or stored key semantics
- lets AI output bypass human-reviewed persistence
