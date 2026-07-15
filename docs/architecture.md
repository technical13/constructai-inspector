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
- Bounded inference transport: `src/inference-gateway.js`
- External CV service: `services/cv_inference/app.py`
- CV model registry: `services/cv_inference/model_registry.py`
- Reproducible CV benchmark: `benchmarks/cv/manifest.json`, `scripts/cv_benchmark.py`

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

### Inference Gateway

Responsible for per-endpoint concurrency, finite queue capacity, end-to-end timeout,
and transport error normalization. Product code must not call external model endpoints
outside this boundary.

### Evaluation

Responsible for versioned benchmark cases, reference provenance, segmentation metrics,
classification checks, and explicit quality gates. Model-generated references are
regression fixtures and must never be represented as independent ground truth.

## Architectural Rule

The application must remain operational when the CV service is absent. The deterministic document workflow is the primary system.

The Node gateway and Python registry are both bounded. The duplicate limit is deliberate:
the gateway protects product traffic, while the registry protects the ML runtime from
direct callers and accidental parallel model loading.
