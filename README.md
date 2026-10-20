[English](README.md) | [Русский](README.ru.md)

# ConstructAI Inspector

ConstructAI Inspector is a mobile-first construction inspection software prototype (`MVP0 + V2`) for documenting defects, reviewing AI suggestions, and generating reports from saved inspection data.

**Public prototype:** [constructai-inspector.vercel.app](https://constructai-inspector.vercel.app/)

Core capabilities include project and inspection session setup, photo-based defect records, human review of suggested defect types, comparison of CV models, crack-mask visualization, and HTML inspection reports. The crack-mask pipeline uses `DeepCrack/Grounding DINO seed -> SAM 2 refine`.

The prototype supports documentation and human review; it does not provide a validated structural safety assessment.

## Public Preview and Local Workspace

The public preview separates live inference from saved demonstrations. It is an experimental prototype, not a production inspection or structural-safety service.

- `Demo Mode` uses **precomputed results from a real CV pipeline** on curated crack images.
- These masks were generated locally through actual inference and then saved for reproducible public display.
- `Try your photo` runs **new live inference** through the configured Hugging Face ZeroGPU Space. Photos are resized locally and sent only after explicit sharing consent and clicking Analyze. Queues, daily quotas, timeouts, and model errors remain possible; failures never silently fall back to a saved mask.
- The public preview does not read or write projects, sessions, defect records, reports, or the demo library. Do not upload confidential photos or personal data; Hugging Face may temporarily cache uploads/results.
- The full inspection and report workflow remains available in **local mode**. Local analysis of your own photos requires the running CV service and necessary model weights; alternatively, an explicitly configured cloud endpoint can be used.

Live inference consumes the server token owner's shared free GPU allowance. Availability is limited, and a model score is not independently validated accuracy or a calibrated probability. See [public preview configuration and limitations](docs/public-preview.md) and [Hugging Face deployment](docs/huggingface.md). The new public release is distinct from earlier fixed revisions that offered precomputed demos only.

Public application: [constructai-inspector.vercel.app](https://constructai-inspector.vercel.app)

## Quick Start

Requirement: Node.js `24.x`.

The simplest way to get started after `git clone`:

```bash
npm run quickstart
```

This command:

- Installs Node dependencies.
- Prepares local runtime directories.
- Starts the web application in **demo mode**.

After startup, open:

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

This is sufficient for a quick walkthrough without CV models.

## Quick Start: Full Local Mode

To reproduce local inference on your own photos:

1. Place the `DeepCrack` checkpoint at:

```text
services/cv_inference/models/deepcrack_ct260.pth
```

2. Run:

```bash
npm run quickstart:full
```

This command:

- Installs Node dependencies.
- Creates `.venv-cv`.
- Installs Python dependencies for the CV service.
- Starts the web UI.
- Starts the local inference service at `127.0.0.1:8001`.

If the checkpoint is missing, full local mode does not start inference; the application remains in demo mode.

## Implemented Features

- Project creation.
- Inspection session setup.
- Photo-based defect recording.
- Structured wording suggestions by defect type.
- `V2`: AI suggestions for defect types, requiring explicit human review.
- Defect overlays on photos and in reports.
- `Grounded SAM 2`: mask-overlay refinement within seed regions from `DeepCrack` or `Grounding DINO`.
- `Demo Mode`: curated photos and saved SAM 2 masks for public display without local Python inference.
- HTML report generation from a saved session snapshot.
- Local filesystem storage for development.
- Optional `Postgres` storage backend; not used by the stateless public preview.
- Fallback storage of images and HTML reports in `Postgres` when `Vercel Blob` is not configured.

## Manual Local Startup

```bash
npm start
```

After startup, open [http://localhost:3000](http://localhost:3000).

Without environment variables, the application uses local storage by default:

- `data/store.json` contains projects, sessions, defects, and reports.
- `data/uploads/` stores defect images.
- `data/reports/` stores generated HTML reports.

To start the web UI in development mode:

```bash
npm run dev
```

This starts only the web UI and is intended for demo mode.

## Manual CV Service Startup

Actual crack geometry and comparison with a zero-shot detector require a separate Python inference service:

```bash
python3.11 -m venv .venv-cv
.venv-cv/bin/pip install -r services/cv_inference/requirements.txt
```

The `DeepCrack` checkpoint is not stored in git. For local inference, place the weights file at:

```text
services/cv_inference/models/deepcrack_ct260.pth
```

```bash
npm run cv:start
```

By default, the web application connects to `http://127.0.0.1:8001`. The service currently supports:

- `DeepCrack`
- `Grounding DINO`
- `Grounded SAM 2`
- `Florence-2`

Optional environment variables:

```bash
CV_INFERENCE_MODE=external
CV_INFERENCE_URL=http://127.0.0.1:8001
CV_MODEL_DEFAULT=grounded-sam2
FLORENCE2_MODEL_ID=florence-community/Florence-2-base-ft
```

AI modes:

- `external`: use the real inference service.
- `mock`: use the built-in mock adapter for development and tests.
- `auto`: try the real service and fall back to mock only if it is unavailable. Mock output is not real model inference.

## Model Selection

The UI provides an explicit AI model selector:

- `DeepCrack`: a crack-segmentation model.
- `Grounding DINO`: a zero-shot detector with stricter filtering and bounding-box deduplication.
- `Grounded SAM 2`: a `seed -> SAM 2` pipeline that first uses `DeepCrack` regions and falls back to `Grounding DINO` if no seed regions are found.
- `Florence-2`: a foundation model connected to the same inference service.
- `Universal CV Adapter`: a unified integration contract for external pretrained models.

After a photo is uploaded, the application compares all configured models on the same image. The selected primary model is used for new photos and for the `Reanalyze` action on a saved defect.

## Reproducible CV Benchmark

The repository includes `benchmarks/cv/manifest.json`, a benchmark manifest with three unique photos and saved reference masks. Validate its contract first:

```bash
npm run benchmark:cv:validate
```

For a live run, start the CV service and execute the following in another terminal:

```bash
npm run benchmark:cv
```

The command calculates `Dice`, `IoU`, precision, recall, and defect-type accuracy for each model. Strict mode returns a nonzero exit code if the quality gate is not met:

```bash
npm run benchmark:cv:enforce
```

The current reference masks are approved outputs from earlier Grounded SAM 2 inference runs. They support regression detection, but **are not independent human annotations and do not establish model accuracy**. Comparative accuracy claims require a separate set of human-annotated masks.

## Demo Mode

The public MVP includes a `Demo Mode` section backed by static files in `public/demo/`:

- `public/demo/images/`: curated crack photos.
- `public/demo/scenarios.json`: saved `Grounded SAM 2` results, including `visualEvidence.maskDataUrl`.

This workflow runs on Vercel without a local Python service: choose `Demo examples` and select a photo to display its saved mask. This does not run new inference. The separate `Try your photo` mode calls the configured cloud service; the full local workspace can use the local CV service.

Demo cases can be added or deleted only in local writable mode. On Vercel, the demo library is automatically read-only: public users can run examples but cannot modify `public/demo/`.

To publish a new example after reviewing its analysis:

1. Start full local mode and analyze a photo.
2. Click `Add to demo`.
3. Review the changes in `public/demo/scenarios.json` and `public/demo/images/`.
4. Run `npm run verify`, commit the changes, and redeploy production.

The public collection is updated only with a new code revision. This preserves reproducibility and prevents visitors from changing the curated demo set.

The distinction is essential for transparent publication:

- Public `Demo examples`: precomputed results on curated examples.
- Public `Try your photo`: new cloud inference, subject to GPU quotas and explicit consent.
- Full local mode: real inference on user-supplied photos.

By default, `DeepCrack`, `Grounding DINO`, `Grounded SAM 2`, and `Florence-2` can use the same local endpoint, `http://127.0.0.1:8001`. To run models through separate services, configure individual endpoints:

```bash
DEEPCRACK_INFERENCE_URL=http://127.0.0.1:8001
GROUNDING_DINO_INFERENCE_URL=http://127.0.0.1:8001
GROUNDED_SAM2_INFERENCE_URL=http://127.0.0.1:8001
FLORENCE2_INFERENCE_URL=http://127.0.0.1:8001
GENERAL_CV_INFERENCE_URL=http://127.0.0.1:8004
```

`Grounding DINO` also exposes stricter post-processing thresholds through environment variables such as `GROUNDING_DINO_MIN_CONFIDENCE` and `GROUNDING_DINO_MAX_BOXES_PER_TYPE`. For `Grounded SAM 2`, you can configure `SAM2_MODEL_ID`, `GROUNDED_SAM2_MAX_BOXES`, and other `SAM2_*` variables.

## Verification

The human review decision is stored separately from whether the chosen type matches the AI suggestion. `Keep manual` records a manual selection; `Accept type` explicitly accepts the suggested type. These are different operator decisions **even when the selected defect type matches the AI suggestion**. Every new analysis requires a new decision. Ambiguous older records are labeled `Review not recorded (legacy)` without modifying the original data.

The public demo and reports identify precomputed results. `Model score` is the model's raw score, not independently validated accuracy or a calibrated probability. The mock adapter is intended for testing, not as a substitute for real inference.

```bash
npm test
```

Tests explicitly use `mock` mode so they do not depend on the Python service.

Full verification baseline:

```bash
npm run verify
```

This runs `lint`, `typecheck`, `test`, `build`, `hygiene`, and `audit` in sequence.

Testing with a separate local PostgreSQL instance is described in `docs/testing.md`.
For a reproducible demonstration without accessing user data:

```bash
npm run evidence:serve
```

This command creates a new isolated store in `logs/evidence-*/runtime`, disables live inference, and starts the application at `http://127.0.0.1:3100`.
Capture workflow and manifest instructions: [docs/evidence-capture.md](docs/evidence-capture.md).

Standalone technical audit:

```bash
npm run audit
```

This checks module reachability, DOM/i18n contracts, demo assets, local entity relationships, and availability of media/report files. Orphaned runtime files are reported as warnings and are never deleted automatically.

Additional repository hygiene check:

```bash
npm run hygiene
```

This checks that source directories contain no `.DS_Store` or Python cache files. Runtime data in `data/`, `.venv-cv/`, `node_modules/`, and model weights are local artifacts and must not be committed to git.

## Vercel Deployment

Public application: [https://constructai-inspector.vercel.app](https://constructai-inspector.vercel.app).

The hosted public preview does not require a laptop to remain online. It uses:

1. Vercel Functions and static assets from `public/`.
2. A configured Hugging Face ZeroGPU Space for optional live analysis.
3. Checked-in, read-only demo scenarios with precomputed masks.

No database is needed for the public preview. Workspace APIs are disabled on Vercel before storage access. Follow [the public deployment configuration](docs/public-preview.md), including the server-only sensitive HF token, payload limits, and quota/error handling.

### Optional Workspace Storage

The existing Postgres/Blob backend remains available for the workspace in a trusted environment, not for anonymous public access. Its configuration is unchanged:

Minimal configuration:

```bash
STORAGE_BACKEND=postgres
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DATABASE
```

Optional:

```bash
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
```

If `BLOB_READ_WRITE_TOKEN` is not set, images and HTML reports are stored in `Postgres` and served through `/api/media/:id` and `/api/reports/:id/document`. This fallback is slower but supports the prototype's preliminary no-cost setup.

### Vercel Setup

1. Import the repository into `Vercel`.
2. Add the inference variables from `docs/public-preview.md`; store the HF token as sensitive. Do not expose it to the browser.
3. Verify a preview deployment, including upload consent, live results, demos, and denied workspace access.
4. Publish the reviewed release. Existing database variables and stored data need not be changed.

Vercel serves static files from `public/` directly. The API runs through `api/index.js` and `vercel.json`.

`.vercelignore` excludes local `.env` files, `.venv-cv`, model weights, and `data/`. `npm run build` checks this boundary to keep user photos and the multi-gigabyte ML environment out of the deployment bundle.

## Architectural Decisions

- `MVP0` does not depend on `AI` and supports the complete deterministic workflow.
- The `V2 skeleton` adds a separate inference layer without making AI the source of truth.
- The actual pixel mask is stored as part of `visualEvidence` and reproduced in the UI and reports.
- Reports are generated only from saved data, not temporary UI state.
- A defect stores its AI suggestion together with the operator's review decision, including acceptance, correction, or keeping the manual selection.
- The backend is separate from the local server: the same API logic runs under both `npm start` and `Vercel Function`.

## Repository Hygiene

Do not commit:

- `.venv-cv/`
- `node_modules/`
- `services/cv_inference/models/`
- `data/store.json`
- `data/uploads/`
- `data/reports/`
- `.env`

These files are local runtime state or may contain user data. Before publishing to GitHub, keep only source code, documentation, configuration, and `services/cv_inference/requirements.txt` in the repository.
