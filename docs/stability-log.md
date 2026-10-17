# Stability Log

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
