# Stability Log

## 2026-10-20 Public Live Preview

- Change summary: Added a separate stateless public photo/demo experience, server-only
  Gradio inference, explicit consent, bounded uploads, provenance/mask checks,
  quota-aware errors, and mandatory Vercel workspace isolation. Local inspection
  storage, human-review decisions and report snapshots are preserved.
- Risk classification: `HIGH`
- Stability score: `4`
- Risk surface score: `4`
- Invariant confidence: `5`
- Test confidence: `4`
- Verification: 56 Node tests passed, one isolated Postgres test skipped because
  TEST_DATABASE_URL was not configured; 13 Python contracts passed. Lint,
  module contracts, build, hygiene and audit passed. Local real browser upload
  returned a live SAM 2 mask, raw score 0.420 and pending human review. EN/RU,
  demo provenance, original/mask toggle and mobile overflow were checked.
- Performance notes: 1600 px / 2 MiB photo cap, 3 MiB JSON cap, one active
  public job and no per-process waiting queue. Deployment manifest excludes
  runtime photos, credentials, weights and historical evidence.
- Remaining risk surface: Shared free HF quota, queues/cold starts, imperfect CV
  classification, and non-distributed burst counters. Public release checks are
  recorded separately with the final deployment/source identifiers; deterministic
  tests do not establish independent model accuracy. Existing three orphan local
  uploads were not deleted. Production Postgres is not read or migrated.

## 2026-10-20: ZeroGPU Preparation

- Change summary: Added an isolated Gradio Space package, CUDA portability,
  checkpoint/model pins, input limits, and opt-in queued Gradio transport.
- Risk classification: `HIGH`
- Stability score: `4`
- Risk surface score: `4`
- Invariant confidence: `5`
- Test confidence: `4`
- Verification: Deterministic verify passed; packaged Gradio UI built with
  Gradio 6.30.0; real local DeepCrack inference through the queued API returned
  a mask and `pending_review`. Final cloud startup/inference is a separate check.
- Performance notes: One active GPU job; four waiting jobs; 120-second GPU
  duration; 1600-pixel maximum inference side; 32 MiB SSE response cap and
  incremental parsing without rescanning accumulated mask data.
- Remaining risk surface: Cloud GPU execution not established by local tests;
  free quotas/queues, model false positives/negatives, optional Postgres test
  skipped without local test DB; three pre-existing orphan uploads left untouched.

## Entry Template

- Date:
- Change summary:
- Risk classification:
- Stability score:
- Risk surface score:
- Invariant confidence:
- Test confidence:
- Performance notes:
- Remaining risk surface:

## 2026-04-16

- Change summary: Added Engineering OS layer, deterministic verify baseline, repo hygiene rules, prompts, and invariant documentation without changing the core runtime stack.
- Risk classification: `MED`
- Stability score: `4`
- Risk surface score: `4`
- Invariant confidence: `4`
- Test confidence: `4`
- Performance notes: Added only lightweight local checks; no hot-path runtime penalty.
- Remaining risk surface: CV model quality remains the primary unresolved product risk.

## 2026-07-13

- Change summary: Performed maintenance audit; restored historical report media resolution, normalized legacy CV types, made public demo fixtures read-only, added atomic JSON writes, recursive linting, repository/data audit, image validation, and dependency remediation.
- Risk classification: `MED`
- Stability score: `5`
- Risk surface score: `4`
- Invariant confidence: `5`
- Test confidence: `4`
- Performance notes: Audit is linear in source/runtime file count and runs only during verification; no new UI or inference hot-path work.
- Remaining risk surface: Git metadata is absent; three orphan local uploads await manual review; Postgres behavior is contract-checked but not integration-tested against a live database.

## 2026-07-15

- Change summary: Added per-endpoint bounded Node inference, lazy and capacity-limited Python model registry, per-model readiness, and a versioned live CV regression benchmark with explicit provenance.
- Risk classification: `HIGH`
- Stability score: `4`
- Risk surface score: `4`
- Invariant confidence: `5`
- Test confidence: `4`
- Performance notes: One active inference per endpoint by default prevents simultaneous model pressure on Apple Silicon; queue and deadline are finite on both runtime boundaries.
- Remaining risk surface: Grounded SAM 2 reproduces all three reference masks but misclassifies `branching-crack` as `corrosion`; references are model-generated and cannot measure real accuracy; three orphan local uploads remain untouched.

## 2026-07-15 Public Deployment

- Change summary: Deployed the read-only CV demo and Node API to Vercel with free Neon Postgres; added deployment exclusions, honest endpoint detection, bilingual demo fallbacks, and live production smoke coverage.
- Risk classification: `HIGH`
- Stability score: `5`
- Risk surface score: `4`
- Invariant confidence: `5`
- Test confidence: `5`
- Performance notes: Deployment input was reduced from 703 MB/21,107 files to 1.8 MB/83 files; public requests do not load Python models.
- Remaining risk surface: online inference is intentionally unavailable; GitHub auto-deploy depends on granting the Vercel GitHub App repository access; three local orphan uploads remain untouched.

## 2026-10-17 Explicit Review Remediation

- Change summary: Replaced inferred AI acceptance with explicit versioned review; aligned UI/domain/storage/report; localized SVG labels and score/provenance text; preserved natural photo geometry; added isolated API tests and evidence-capture tooling.
- Risk classification: `HIGH`
- Stability score: `4`
- Risk surface score: `4`
- Invariant confidence: `5`
- Test confidence: `4`
- Verification: 34 Node tests (including local filesystem and real disposable PostgreSQL parity) and 8 Python contracts; full verify passed.
- Performance notes: Constant-size review transitions, optional JSON metadata only, no extra CV calls. Report snapshots own a deep copy of saved suggestion metadata.
- Remaining risk surface: Existing legacy decisions cannot be reconstructed; live CV quality is not independently validated; production is intentionally unchanged pending separate deployment authorization; three original orphan uploads remain untouched.
- Browser follow-up (`LOW`): Removed the redundant decision badge from saved thumbnails after discovering overlap with the model tag at 768 px. The dedicated adjacent decision indicator remains visible. The eight original workflow captures remain archived; post-fix responsive captures are kept separately.
- Evidence follow-up: Completed all eight real EN workflow frames and three supplemental responsive frames using fictional local data only. Both non-overwriting SHA-256 manifests were rechecked. Form/saved-record/report at 390/768/1440 px have no horizontal page overflow and matching photo/SVG dimensions. Full A-I report: `docs/remediation-2026-10-17.md`. Production remains unchanged.
