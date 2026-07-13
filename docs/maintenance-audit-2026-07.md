# Maintenance Audit — 2026-07

## Objective

Restore a trustworthy maintenance baseline after a three-month pause without deleting user data or expanding product scope.

## Required Changes

1. Preserve photo identity in new report snapshots and keep legacy report media resolvable after a live defect is deleted.
2. Normalize the legacy CV type `void` to the domain type `honeycombing`.
3. Expose demo-library write controls only when the runtime is explicitly writable; public Vercel mode remains read-only.
4. Replace manually enumerated syntax checks with recursive source discovery.
5. Add a deterministic repository audit for unreachable modules, browser contracts, demo assets, domain links, and runtime media references.
6. Include hygiene and audit in `npm run verify`.
7. Resolve known production dependency advisories without changing the application architecture.

## Acceptance Criteria

- existing `data/store.json`, uploaded photos, reports, and demo scenarios remain readable
- old report snapshots without `photo.id` or `photo.fileName` remain supported
- no unsupported CV type reaches persisted human-reviewed state
- public deployments cannot mutate the checked-in demo library
- every JavaScript/Python source file is syntax-checked automatically
- `npm run verify` and `npm audit --omit=dev` are green
- runtime smoke confirms bootstrap and static assets remain reachable

## Non-Goals

- deleting orphan user uploads automatically
- changing the CV models or model thresholds
- redesigning the interface
- introducing authentication or multi-tenancy
