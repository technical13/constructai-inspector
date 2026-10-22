# Invariants

## Core Domain Invariants

1. Every `Defect` belongs to exactly one existing `Session`.
2. Every `Session` belongs to exactly one existing `Project`.
3. Every saved `Defect` has at least one persisted photo.
4. A `Report` contains only defects from its own session snapshot.
5. A `Report` is reproducible from stored snapshot data without consulting live UI state.
6. `aiSuggestion` may influence operator workflow but may not silently overwrite human-confirmed persisted truth.
7. `visualEvidence` is optional metadata; absence of CV data must not block the deterministic workflow.
8. Every external inference attempt has a finite deadline, active-concurrency limit, and finite queue.
9. A benchmark reference records its provenance; only independently human-annotated references may support accuracy claims.
10. An unavailable model adapter must not prevent independent adapters from starting or reporting readiness.
11. A matching suggested/final type never proves acceptance. New reviews have `review.version=1` and an explicit decision independent of `typeMatchesSuggestion`.
12. `manual` survives saving and subsequent type edits until the operator explicitly changes the review. A new inference result starts pending and has a new `suggestionId`.
13. Legacy status flags without a versioned review are not evidence of an explicit human action. Reading them must not rewrite stored data or historical HTML.
14. A cloud queue error, missing completion event, timeout, or exhausted GPU quota is not a successful inference result and must not trigger implicit retries or acceptance.
15. A cloud upload package contains only allowlisted code, pinned public-model artifacts, and build metadata, never project storage, user photos, credentials, or historical evidence.
16. The public Vercel preview cannot read or mutate workspace projects, sessions, defects, media, reports, or the demo library. It never opens a database connection.
17. Public live inference requires explicit upload consent, one supported model, bounded raster payloads, verified input provenance, and matching mask dimensions. No result is auto-accepted.
18. Switching photo or mode invalidates in-flight results. A failed live request never becomes a precomputed demo result implicitly.
19. Retiring a model removes execution, not saved provenance. Historical SAM 2 records/masks are never renamed to SAM 3; explicit retired-key requests fail instead of executing another model.
20. SAM 3 weights match the canonical pinned SHA-256. Empty results remain empty, all nonempty instance masks are unioned, native scores are not calibrated or rounded, and cloud provenance must match the expected revision/hash.

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

- `pending_review -> accepted|corrected|manual` follows an operator action
- changing an accepted type yields `corrected`; returning to the suggested type yields `pending_review`, never implicit acceptance
- saved review actions identify the current `suggestionId`; stale actions return HTTP 409
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
- permits unbounded CV execution or an unbounded inference queue
- labels a model-generated regression fixture as human ground truth
