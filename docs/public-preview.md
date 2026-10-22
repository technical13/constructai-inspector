# Public Live Preview

Risk: HIGH. This is a new release, not the unchanged application at `3556e38`.
Historical evidence, report snapshots, data files, and fixed revision links are
not rewritten. No production database migration is necessary.

## User Experience

- Vercel redirects `/` and `/index.html` to `/try`, which serves `public/try.html`.
  An ordinary root rewrite loses to Vercel's static index-file handling.
  English is the default, with
  a persistent RU/EN language preference. Photos/results stay in page memory.
- **Try your photo** resizes locally, requires explicit sharing consent, and
  submits exactly one live SAM 3 analysis via the server in this source version.
  The existing deployment is unchanged until the coordinated release in
  `docs/sam3-migration.md` is authorized and completed.
- **Demo examples** reads the existing checked-in image/mask library, clearly
  labeled as precomputed. It performs no inference and never auto-accepts a type.
- Original/mask switching uses the same uncropped image geometry. No artificial
  contour is drawn when a model returns no mask or an error.
- The full project/session/defect/report workflow remains available locally.
  On Vercel, workspace APIs return HTTP 403 before calling any storage function.

## Configuration

Set these only on the reviewed preview/production environment. Existing database
variables need not be read, exported, modified, or deleted.

```bash
CV_INFERENCE_MODE=external
CV_INFERENCE_TRANSPORT=gradio
SAM3_INFERENCE_URL=https://your-tested-sam3-space.hf.space
CV_INFERENCE_MAX_CONCURRENCY=1
CV_INFERENCE_MAX_QUEUE=0
```

Store `CV_INFERENCE_TOKEN` as a **sensitive, server-only** Vercel variable with
the minimum HF read permission. Never pass it via browser code, URLs, shell
arguments, screenshots, logs, or committed files. All visitors using this token
share its owner's GPU quota. Do not add PRO, credits or paid hardware as fallback.

The new public endpoint has a fixed 165-second inference deadline; the browser
waits at most 175 seconds. `api/index.js` has `maxDuration: 180`. Verify Fluid
Compute is available on the deployment; legacy Hobby function limits may be
shorter. Timeouts remain errors, never cached-demo success.

For a local public-preview server, set `PUBLIC_PREVIEW_MODE=true` in addition to
the inference configuration and run `npm start`. Unset this flag for the local
inspection workspace. Vercel cannot opt out of the public storage guard.

## Limits And Privacy

- Browser accepts JPEG/PNG/WebP up to 12 MiB / 12 million pixels and resizes to
  maximum side 1600 px, JPEG at most 2 MiB. Metadata is not copied to the canvas.
- Server JSON is at most 3 MiB, below Vercel's 4.5 MB function payload limit.
- Only the configured HTTPS `*.hf.space` root can receive the server token.
- A returned PNG mask is at most 2 MiB, matches inference dimensions, and has
  the input SHA-256 provenance. Public JSON is at most 3 MiB and not cached.
- Model key, pinned revision and weights hash must match the SAM 3 lock.
  A previous SAM 2 response is rejected, never relabeled as a new model result.
- One analysis is active per process, with no waiting queue. Per-process burst
  guard: two attempts per client and four total per 60-second window. It stores
  only temporary salted client hashes, not IPs or photos.
- These counters are **not distributed** across serverless instances or cold
  starts. They reduce accidental bursts, not determined abuse. HF enforces the
  hard account-wide quota and its shared inference queue. A small public
  prototype cannot promise unlimited use, uptime, fairness, or successful access
  at an arbitrary future time. Durable edge rate limiting is a future hardening
  step if public traffic requires it; no new paid service is assumed here.
- The application does not write uploaded photos/results to workspace storage.
  Vercel and HF process them; Gradio may temporarily cache them. Use only
  non-sensitive photos, not private project data or personal documents.
- Canceling/changing a photo aborts the browser request and discards stale UI
  results, but cannot guarantee cancellation of a GPU job already submitted.

## Verification And Release

1. Run `npm run verify`; optional Postgres testing must stay explicitly skipped
   unless an isolated local test database is available.
2. Check no `.env`, credentials, runtime media, weights, or historical evidence
   are included in the deployment input or Git commit.
3. Deploy a reviewed preview first, verify `/api/preview/config`, workspace 403,
   static assets, real anonymous-browser upload, mask, both languages and demos.
4. After authorization, publish/promote the tested release to production and
   verify the main URL without account/session credentials.
5. Record the source SHA and deployment metadata. Keep the old fixed revision
   and evidence set separate; do not reuse the old unchanged-code assertion.

The raw model score is not calibrated probability or independently validated
accuracy. Current models can misclassify a visible crack as another defect;
segmentation must remain a suggestion requiring human review, not a confirmed
structural-safety determination.
