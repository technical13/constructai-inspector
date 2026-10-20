# Hugging Face ZeroGPU

## Scope

Risk: HIGH (public photo processing, third-party GPU quota, model portability).
This is a separate live-inference Space, not a replacement of the verified Vercel
deployment or its stored reports. It runs the existing DeepCrack -> SAM 2 pipeline
with Grounding DINO fallback seed detection. Florence-2 is not exposed here.

The Space has a small Gradio test UI. The existing web application can use its
queued API through the optional `gradio` transport. Publishing a Space alone
does not enable live analysis in the deployed Vercel web application.

## Zero-Cost Boundary

Only select **ZeroGPU Free**. Do not request dedicated GPUs, paid storage, PRO,
prepaid credits, or another billable upgrade as an automatic fallback. Free-tier
eligibility and quotas are controlled by Hugging Face, not this repository.

The official documentation currently allows up to two ZeroGPU Spaces for eligible
personal accounts with verified email and an account older than 30 days.
Queues and daily GPU allowances apply. API requests using one server-side token
share that account's allowance; they do not provide unlimited public inference.

Sources checked 2026-10-20:
- https://huggingface.co/docs/hub/spaces-zerogpu
- https://huggingface.co/docs/hub/spaces-api-endpoints
- https://huggingface.co/docs/hub/spaces-config-reference

## Build a Minimal Upload

The local DeepCrack checkpoint is required at
`services/cv_inference/models/deepcrack_ct260.pth`. Its SHA-256 must match
`deploy/huggingface/models.json`. It remains excluded from the GitHub repository.

```bash
npm run package:hf
```

The command creates a new `logs/huggingface-space-*` directory on every run.
It copies only an explicit file allowlist: the Space entry point, metadata,
requirements, four CV modules, and the one verified checkpoint. It never copies
`.env`, `.git`, Postgres credentials, reports, project data, user photos,
historical evidence packages, or the local Python environment.

`build-info.json` records source commit, dirty-working-tree status, and SHA-256
of each bundled file. Use a clean, reviewed source commit for the final upload;
a dirty snapshot must not be labeled as that commit's exact source.

Upload the directory contents to a dedicated **Gradio / ZeroGPU Free** Space.
The Space root must contain `app.py`, `README.md`, `models.json`,
`requirements.txt`, and `services/cv_inference/...` with the same relative paths.
The Space is public: bundled code and weights are downloadable. Never upload
private data or credentials. Keep third-party model attribution/provenance.

## Runtime Contract

- Python 3.12.12, Gradio 6.30.0, spaces 0.51.3.
- The CV dependencies remain pinned in `services/cv_inference/requirements.txt`.
- The Space requirements repeat the CV pins without nested `-r` includes:
  the Gradio image builder mounts only the root requirements file under `/tmp`.
  A deterministic test checks dependency parity.
- Space-only exception: `pydantic==2.12.5` because Hugging Face automatically
  installs `gradio[mcp,oauth]`, whose MCP extra caps Pydantic at 2.12.5.
  The local CV runtime keeps its original Pydantic pin; no environment is downgraded.
- SAM 2 and Grounding DINO revisions are pinned in `models.json`.
- ZeroGPU imports `spaces` before allocating emulated CUDA tensors.
- Model weights are loaded at startup, outside the decorated GPU function.
- `@spaces.GPU(duration=120)` bounds GPU function execution.
- Gradio runs one CV job at a time, with a queue of at most four waiting jobs.
- Supported API model keys: `deepcrack`, `grounded-sam2`.
- Accepted raster formats: PNG/JPEG/WebP; maximum 12 MiB and 12 million pixels.
- Images are resized to a maximum side of 1600 pixels for inference.
- Input hashes and dimensions are recorded, but image bytes are not logged.
- No project/session storage or report-generation service runs in the Space.
- Gradio can temporarily cache uploads/results; cleanup is best-effort, not a
  guarantee that sensitive uploads are safe. Use only non-sensitive test photos.

## Optional Web-App Connection

Do not set these in production until the new source revision and cloud smoke
test have passed review. No Vercel setting is changed by packaging the Space.

```bash
CV_INFERENCE_MODE=external
CV_INFERENCE_TRANSPORT=gradio
CV_MODEL_DEFAULT=grounded-sam2
GROUNDED_SAM2_INFERENCE_URL=https://your-space.hf.space
DEEPCRACK_INFERENCE_URL=https://your-space.hf.space
CV_INFERENCE_MAX_CONCURRENCY=1
CV_INFERENCE_MAX_QUEUE=4
CV_INFERENCE_TIMEOUT_MS=180000
```

Optionally set `CV_INFERENCE_TOKEN` to a Hugging Face token with only the access
needed to call the Space. Never put the token in browser JavaScript, query
parameters, documentation, commits, screenshots, or logs. Do not set the global
`CV_INFERENCE_URL` if unsupported model adapters should remain disconnected.

The Node gateway submits exactly one Gradio job, consumes its SSE stream under
the existing finite deadline, and accepts only a completed result. It bounds
response size, rejects malformed event IDs, does not follow credential-bearing
redirects, and does not automatically retry failed or quota-limited jobs.
The serverless platform's own execution deadline also applies; use the Space UI
for direct testing if a cold start exceeds the web deployment's request budget.

## Acceptance Checks

1. Confirm actual hardware is ZeroGPU Free and no billing upgrade was enabled.
2. Wait for build/startup readiness, not just repository creation.
3. Upload a non-sensitive crack photo and run live analysis.
4. Verify returned `analysisMode=live`, `status=pending_review`, model provenance,
   input dimensions, and a mask matching the analyzed image dimensions.
5. Test a different uploaded image and a negative/control image. Detection is
   not guaranteed: false positives and false negatives must remain explicit.
6. Test malformed/oversized inputs and quota/service failure handling.
7. Run `npm run verify`; the deterministic baseline does not claim a live GPU test.

Public cached demo results remain labeled as precomputed. Live analysis never
accepts a defect type on the operator's behalf. Existing saved review actions,
report snapshots, historical evidence, and the verified commit stay unchanged.
