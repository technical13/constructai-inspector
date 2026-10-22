# Hugging Face SAM 3 Service

Risk: HIGH. This source prepares a SAM 3 release; it does not change an existing
Space or Vercel deployment automatically. See [sam3-migration.md](sam3-migration.md).

## Model And Access

The cloud service runs only pretrained Meta SAM 3 with `crack in concrete`.
It has no DeepCrack, Grounding DINO or SAM 2 dependency. The canonical lock is
`services/cv_inference/sam3-model.json`; the package copies the same file to
`models.json` and next to the adapter. Startup rejects disagreement and verifies
the weights SHA-256 before loading.

The Space owner must obtain [official model access](https://huggingface.co/facebook/sam3)
and review the [Meta SAM license](https://huggingface.co/facebook/sam3/blob/main/LICENSE)
themselves. Store a separate approved public-gated-read token as the Space's
`HF_TOKEN` **secret**, never a public variable, source file or browser value.
Weights are downloaded privately at startup from the pinned official revision.
Do not copy gated weights into the public Space repository or GitHub.

The server-only Vercel `CV_INFERENCE_TOKEN` is a separate credential for calling
the Space. Visitors do not supply credentials and share its owner's quota.
Changing the local HF CLI token does not configure either hosted secret.

## Zero-Cost Boundary

Use only existing eligible **ZeroGPU Free** hardware. Do not enable PRO, credits,
dedicated GPUs, paid storage or any paid fallback. Eligibility and quota are
controlled by Hugging Face. Queues, cold starts and daily limits remain possible.
Hosting/configuration instructions: https://huggingface.co/docs/hub/spaces-zerogpu

## Minimal Package

```bash
npm run package:hf
```

Every run creates a new `logs/huggingface-space-*` folder. An explicit allowlist
includes the Gradio entry point, metadata, requirements, SAM 3 adapter and lock,
cloud payload contract, registry and package initializer. It includes **no
weights**, other model implementations, `.env`, credentials, user media, reports,
database, historical evidence, Python environment or Git history.
`build-info.json` records source commit, dirty status and artifact SHA-256.
A dirty package is not the exact contents of its base commit.

After release authorization, upload only that folder's contents to a dedicated
Gradio / ZeroGPU Free Space. Its source is public. Configure `HF_TOKEN` securely
and confirm actual startup/inference success before changing Vercel.

## Runtime Contract

- Python 3.12.12, Gradio 6.30.0, spaces 0.51.3.
- Root requirements are self-contained; the builder initially mounts only this file.
- CV pins match local requirements except the documented Space-only
  `pydantic==2.12.5` override needed by injected `gradio[mcp,oauth]` dependencies.
- Import `spaces` before allocating emulated CUDA tensors. Set `CV_DEVICE=cuda`
  on Space; load the model at startup, outside `@spaces.GPU(duration=120)`.
- One active job, four waiting Gradio jobs; the internal registry has no extra queue.
- API model key is only `sam3`. Retired keys are rejected, never redirected.
- Accept PNG/JPEG/WebP, maximum 12 MiB and 12 million pixels, resized to side 1600.
- Fixed prompt and score/mask thresholds of 0.5. Union all nonempty masks.
- Postprocess instances one at a time to bound full-image mask allocations.
  Reject more than 64 candidate masks rather than silently dropping regions.
- Preserve native scores without rounding or calling them validated accuracy.
- Empty decoder-sized tensors represent zero instances, not a fabricated mask.
- Input SHA-256, inference dimensions and pinned model provenance accompany results.
- No inspection database or report-generation service runs on Space.
- Gradio cache cleanup is best-effort, not a privacy guarantee.

## Web Connection

Only after the new Space passes live smoke tests and deployment is authorized:

```bash
CV_INFERENCE_MODE=external
CV_INFERENCE_TRANSPORT=gradio
CV_MODEL_DEFAULT=sam3
SAM3_INFERENCE_URL=https://your-sam3-space.hf.space
CV_INFERENCE_MAX_CONCURRENCY=1
CV_INFERENCE_MAX_QUEUE=0
CV_INFERENCE_TIMEOUT_MS=180000
```

Keep `CV_INFERENCE_TOKEN` sensitive and server-only. Do not set the global
`CV_INFERENCE_URL` to a SAM-3-only Space: other local adapters are unsupported there.
The backend submits one queued Gradio job, consumes only a completed SSE result,
uses a finite deadline and does not automatically retry quota errors.
The public preview requires model key, revision and weights hash to match its
own lock. An old SAM 2 Space cannot be relabeled as a SAM 3 success.

## Release Checks

1. Run `npm run verify`; Postgres remains explicitly skipped without an isolated DB.
2. Inspect package and Git diff for secrets, runtime data and weights.
3. Confirm ZeroGPU Free hardware and successful gated-weight startup.
4. Analyze a new non-sensitive photo and a background/control image.
5. Check mask geometry, raw score, pending review and exact model provenance.
6. Check multiple regions, empty outputs, malformed input, quotas and timeouts.
7. Release the reviewed web version with the SAM 3 endpoint only after authorization.
8. Smoke-test public EN/RU, original/mask switching and historical demos.
9. Retain the previous deployment for rollback; delete hosted resources only with approval.

No cloud GPU smoke is implied by a green local test suite. Local CPU success
does not guarantee ZeroGPU startup or latency. Historical demo masks and report
snapshots keep their original provenance and never become SAM 3 results by renaming.
