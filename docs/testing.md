# Testing

## Deterministic Verify Baseline

- `npm run lint`
  - JavaScript syntax checks for browser, API, domain, storage, and tests
  - Python syntax compilation for the DeepCrack service
- `npm run typecheck`
  - verifies required exported module contracts are present
- `npm test`
  - runs deterministic Node tests in `mock` inference mode
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

- core domain invariants
- report reproducibility from stored snapshot data
- AI suggestion review persistence behavior
- storage backend selection rules
- historical report media access after live defect deletion
- local demo write capability versus read-only public deployment
- bounded inference FIFO, queue overflow, and timeout behavior
- Python model registry readiness and saturation behavior
- segmentation metric determinism and benchmark provenance

## Benchmark Interpretation

The checked-in `constructai-crack-regression-v1` references are approved historical model
outputs. They test reproducibility and drift, not real-world accuracy. Accuracy ranking
requires a separate manifest with independently human-annotated masks and
`referencePolicy.kind = human-annotated`.
