# Testing

## Deterministic Verify Baseline

- `npm run lint`
  - JavaScript syntax checks for browser, API, domain, storage, and tests
  - Python syntax compilation for the DeepCrack service
- `npm run typecheck`
  - verifies required exported module contracts are present
- `npm test`
  - runs deterministic smoke tests in `mock` inference mode
- `npm run build`
  - verifies runtime assets and deployment manifest required for local/Vercel execution
- `npm run hygiene`
  - rejects local garbage in source-controlled areas
- `npm run audit`
  - checks source reachability, DOM/i18n contracts, demo assets, local entity links, and media/report references
- `npm run verify`
  - canonical meta-command: `lint -> typecheck -> test -> build -> hygiene -> audit`

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
