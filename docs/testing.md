# Testing

## Deterministic Verify Baseline

- `npm run lint`
  - JavaScript syntax checks for browser, API, domain, storage, and tests
  - Python syntax compilation for the DeepCrack service
- `npm run typecheck`
  - verifies required exported module contracts are present
- `npm test`
  - runs only `test/*.test.js` in `mock` inference mode, not archived copies under logs/output
  - runs dependency-free Python contract tests for the model registry and benchmark metrics
- `npm run build`
  - verifies runtime assets and deployment manifest required for local/Vercel execution
- `npm run hygiene`
  - rejects local garbage in source-controlled areas
- `npm run audit`
  - checks source reachability, DOM/i18n contracts, demo assets, local entity links, and media/report references
- `npm run verify`
  - canonical meta-command: `lint -> typecheck -> test -> build -> hygiene -> audit`
- `npm run benchmark:cv:validate`
  - validates benchmark provenance, unique cases, images, and stored reference masks
- `npm run benchmark:cv`
  - executes the default models against the live local CV endpoint and reports metrics
- `npm run benchmark:cv:enforce`
  - executes the live benchmark and exits non-zero when a quality gate fails

## Rules

- `npm run verify` is required before claiming substantial completion.
- If one command fails, fix the smallest safe surface and rerun the full baseline.
- Tests must prefer deterministic fixtures over live CV inference.

## Current Coverage

- shared photo picker/drop validation, nested drag feedback, disabled zones,
  URL rejection, file navigation guards, and stale local read invalidation
- current SAM 3 demo source hashes, pinned provenance, PNG dimensions, raw scores
  and pending human review; historical SAM 2 compatibility remains separately tested
- core domain invariants
- report reproducibility from stored snapshot data
- AI suggestion review persistence behavior
- storage backend selection rules
- historical report media access after live defect deletion
- local demo write capability versus read-only public deployment
- bounded inference FIFO, queue overflow, and timeout behavior
- Gradio job submission, SSE completion/error/EOF, job-ID validation, quota failure,
  and shared deadlines (`test/huggingface-inference.test.js`)
- CUDA/MPS/CPU device selection and bounded cloud payload contracts
  (`services/cv_inference/tests/test_cloud_contract.py`)
- Python model registry readiness and saturation behavior
- stateless public API isolation, consent, payload/provenance limits,
  concurrency/burst guards, failure honesty, bilingual labels, and stale-result
  invalidation (`test/public-preview.test.js`)
- SAM 3 pinned weights/configuration, empty native mask geometry, unrounded
  scores, retired execution rejection and historical provenance preservation
  (`test/sam3-migration.test.js`, `services/cv_inference/tests/test_sam3_contract.py`)
- code-only SAM 3 Space packaging with no retired implementation or weights
- segmentation metric determinism and benchmark provenance

## Benchmark Interpretation

The checked-in `constructai-crack-regression-v1` references are approved historical model
outputs. They test reproducibility and drift, not real-world accuracy. Accuracy ranking
requires a separate manifest with independently human-annotated masks and
`referencePolicy.kind = human-annotated`.

SAM 3 is now the default execution model; these historical SAM 2 references have
not been replaced or renamed. Strict cross-model similarity gates may fail and
must not be lowered merely to make a model replacement green.

## Human Review Regressions

`test/review-state.test.js` covers explicit manual/accepted/corrected/pending
decisions, legacy reads, independent snapshot ownership, English SVG labels,
unaltered scores, and stale suggestion review rejection.

`test/storage-review.test.js` runs the real HTTP API against a temporary local
data directory and a deterministic mock CV endpoint. It checks create, edit,
reload, report immutability, unavailable inference, reanalysis, and saved review.
The identical suite runs against optional local Postgres when
`TEST_DATABASE_URL` points to a localhost database named `constructai_test_*`.
Production hosts are rejected before any SQL is executed. No mandatory new
infrastructure dependency was added.

ZeroGPU startup and real uploaded-photo checks are separate, environment-dependent
checks described in `docs/huggingface.md`. Passing deterministic tests alone does
not establish that the cloud Space is running or that model accuracy is validated.

Example with a disposable local PostgreSQL instance:

```bash
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/constructai_test_review npm run verify
```

Without that variable, Postgres integration is explicitly skipped; the local
suite and shared domain tests still run. Browser capture instructions are in
`docs/evidence-capture.md`.
