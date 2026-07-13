# Architecture

## Runtime Shape

The repository is intentionally preserved as an existing web runtime rather than rewritten to a new preset.

- Browser UI: `public/index.html`, `public/app.js`, `public/app.css`
- HTTP runtime: `src/server.js`
- Shared API handler: `src/api-handler.js`
- Domain rules: `src/domain.js`, `src/catalog.js`
- Persistence abstraction: `src/store.js`
- Local storage backend: `src/local-store.js`
- Postgres storage backend: `src/postgres-store.js`
- Report snapshot/rendering: `src/report.js`
- AI orchestration: `src/inference.js`
- External CV service: `services/cv_inference/app.py`

## Boundaries

### UI

Responsible for step flow, capture, confirmation, and deterministic display. It must never invent persisted truth.

### API

Responsible for request validation, route dispatch, and storage/inference orchestration.

### Domain

Responsible for entity construction, mutation rules, and invariant-safe normalization.

### Storage

Responsible for persistence, retrieval, and report/media durability.

### CV

Responsible only for suggestive output. It must not own final classification.

## Architectural Rule

The application must remain operational when the CV service is absent. The deterministic document workflow is the primary system.
