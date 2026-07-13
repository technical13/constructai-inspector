# ConstructAI Inspector Agent Contract

1. Execution cycle: Plan -> Decompose -> Risk classify -> Implement -> Validate -> Audit -> Integrate -> Score -> Report.
2. Risk classification is mandatory for every non-trivial change: `LOW`, `MED`, `HIGH`.
3. CLAW role simulation is always internal:
   - `C`ontract checks scope, invariants, decisions.
   - `L`ogic designs smallest safe change.
   - `A`udit verifies regressions, edge cases, compatibility.
   - `W`orker implements and integrates.
4. Do not treat green tests as automatic completion if risk surface is still reducible.
5. Verify before completion is mandatory: run `npm run verify` unless task scope explicitly prevents it.
6. Integration barrier:
   - invariants preserved
   - storage contract preserved
   - UI/report parity preserved where applicable
   - backward compatibility checked for persisted data
7. Autopilot continuation rule:
   - if the next safe step is obvious and non-destructive, continue
   - if the next step risks schema/runtime breakage, stop and surface the conflict
8. Stability scoring is required in every substantial close-out:
   - stability `1-5`
   - risk surface `1-5`
   - invariant confidence `1-5`
   - test confidence `1-5`
9. If any score is below `4`, reduce risk before claiming completion unless blocked externally.
10. No premature green exit. Passing validation is necessary, not sufficient.
11. Progressive disclosure:
   - operating model: `docs/os-ultra.md`
   - domain and invariants: `docs/domain.md`, `docs/invariants.md`
   - testing baseline: `docs/testing.md`
   - risk memory: `docs/regression-memory.md`
12. Safety override: preserve the existing runtime and user data unless a destructive rewrite is explicitly approved.
