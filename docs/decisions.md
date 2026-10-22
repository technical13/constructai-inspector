# Decisions

## 2026-10-21: SAM 3 Primary, SAM 2 Execution Retired

- Risk: HIGH. A small real CPU A/B comparison motivated choosing pretrained
  Meta SAM 3 for the default crack-mask workflow; it is not an accuracy claim.
- Remove the SAM 2 adapter/seed plumbing and cloud weights bundle rather than
  leaving an inactive implementation. Keep independent auxiliary local adapters.
- Preserve historical model keys, demo masks, saved reviews and report snapshots.
  Reject retired execution keys; never silently alias them or relabel old output.
- Download official gated SAM 3 weights separately with checksum verification.
  Use a Space secret for gated reads; package code only, never weights/tokens.
- Prepare source/configuration locally. GitHub publication, coordinated HF/Vercel
  release and any hosted-resource deletion require separate authorization.
- Keep historical benchmark references/gates unchanged apart from selecting the
  new execution model. Cross-model drift is not independent segmentation accuracy.

## 2026-10-20: Stateless Public Live Preview

- Risk: HIGH. Add a separate small public interface, not a tenant/auth rewrite of
  the inspection workspace. Vercel always guards workspace APIs before storage.
- A consented photo is resized locally and sent through one bounded server-side
  Gradio call. Only the configured SAM 2 pipeline is exposed publicly; its raw
  score and type remain provisional. Existing local model comparison is preserved.
- Demo selection loads existing fixtures explicitly, without live inference or
  inherited accepted flags. Stale results are discarded after photo/mode changes.
- Keep existing schema, reports, photos, historical evidence and fixed commits
  unchanged. Publish the new app under a new revision; never reuse the old
  unchanged-application-code assertion for this release.
- The free quota belongs to the server token owner. A per-process burst limiter
  is not a distributed fair-use guarantee; provider quotas and queue limits remain
  explicit. No new paid service or production database mutation is required.

## 2026-10-20: Isolated Hugging Face ZeroGPU Companion

- Decision: deploy a separate Gradio ZeroGPU Space using the existing DeepCrack
  and SAM 2 inference code, with Grounding DINO fallback; keep Vercel production
  and all historical evidence unchanged during cloud validation.
- Boundary: opt-in Gradio transport; REST remains the default. No storage schema,
  human-review transition, report snapshot, or browser UI changes are required.
- Reproducibility: pin model revisions and checkpoint SHA-256; package an explicit
  file allowlist, with a source/build manifest. Do not upload the whole repository.
- Resource policy: one active job, finite queues/deadlines and response sizes;
  no automatic retries, paid GPU upgrade, or fallback to mock inference.
- Portability: prefer CUDA when present, preserve Mac MPS/CPU, and use float32
  inputs with float32 model weights rather than untested half-precision inputs.
- Constraint: shared free GPU quotas/queues are not an always-on SLA or independent
  accuracy validation. One backend token means one shared account allowance.

## 2026-10-17: Explicit Review And Evidence Readiness

- Risk: `HIGH` (persisted decision semantics and report provenance).
- Store an additive, versioned review inside existing suggestion JSON; keep `status` as a compatibility mirror for new writes. Do not migrate old rows or regenerate old documents.
- Only an explicit Accept action can yield `accepted`. Type equality is stored independently. Fresh inference always starts pending; saved review actions identify the suggestion they address.
- Existing ambiguous flags display as legacy/unverified without altering their stored form.
- Use the same domain constructors and pure review contract for filesystem and Postgres. Postgres edits persist updated review JSON and reject stale concurrent writes.
- Demo results retain their original scores and masks, with explicit `precomputed_demo` provenance. Mock results are visibly identified as test output.
- Capture only local fictional data in a unique ignored evidence directory. No push, production deployment, production writes, or historical-evidence replacement is part of this remediation.

## 2026-07-15: Public Vercel Boundary

- Decision: deploy the browser UI and Node API to Vercel with free Neon Postgres persistence.
- Public CV contract: checked-in, precomputed demo masks only; no model is advertised as configured without an explicit reachable endpoint.
- Demo mutation contract: local-only `Отправить в демо`; Vercel remains read-only and receives new curated cases through source control and redeploy.
- Deployment barrier: `.vercelignore` excludes secrets, local user data, Python environments, and model weights; the build validates critical exclusions.
- Runtime: Node.js is pinned to `24.x` to prevent implicit Vercel major-version upgrades.
- Rationale: preserve an honest, free public demo without pretending that the developer's Mac is an online inference server.

## 2026-07-15: Bounded Inference Boundary

- Decision: route external CV calls through a per-endpoint FIFO executor with finite concurrency, queue capacity, and end-to-end timeout.
- Default: one active request, eight queued requests, 120-second deadline per endpoint.
- Rationale: simultaneous loading/execution of several pretrained models is unsafe on a single Apple Silicon workstation.
- Defense in depth: Python registry independently enforces its own capacity for direct callers.

## 2026-07-15: Benchmark Provenance Before Accuracy Claims

- Decision: introduce a versioned segmentation regression benchmark using three unique curated demo cases.
- Current references: operator-approved historical Grounded SAM 2 outputs.
- Constraint: `accuracyClaimAllowed=false`; these fixtures detect drift but cannot establish accuracy.
- Evolution: a model may be ranked for accuracy only against independently human-annotated masks.

## 2026-07-13: Braun Instrument Design Contract

- Decision: add a repository-level `DESIGN.md` and align the browser UI and generated reports to it.
- Direction: Braun/Dieter Rams restraint with adapted Swiss-Bauhaus structure from Refero Yllw and Index references.
- Constraints: flat surfaces, 2-6px radii, no shadows or gradients, IBM Plex Sans/Mono, one functional signal yellow.
- Rationale: remove generic SaaS styling while preserving the single-step workflow and making CV evidence the primary visual event.
- Boundary: design changes must not alter domain state, persistence contracts, model provenance, or report evidence.

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
