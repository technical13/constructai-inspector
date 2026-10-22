# SAM 3 Migration

Date: 2026-10-21. Risk: HIGH. Base application: `fe8978a5fa4b300e274c1bf1a2ba812dcfb12569`.

## Scope

SAM 3 becomes the default active crack-mask adapter, key `sam3`.
The SAM 2 class, imports, seed plumbing, constants, registry entry, execution
endpoint and cloud packaging are removed. DeepCrack, Grounding DINO and
Florence-2 remain independently selectable local adapters, not SAM 3 dependencies.

This is not a data migration. Saved `grounded-sam2` provenance, original demo
images/masks, human review decisions, report snapshots and earlier evidence
are preserved. Compatibility renderers/tests for these records are intentional
live code, not a dormant SAM 2 inference implementation.

New `grounded-sam2` requests fail explicitly. Unknown model keys never silently
execute a different model. Finalizing a saved suggestion preserves its model
key/label/version, including retired keys. A new analysis has a new suggestion
and pending review, not an inferred acceptance.

## Local Setup

Obtain official `facebook/sam3` access yourself, sign in with
`.venv-cv/bin/hf auth login --force`, then run:

```bash
.venv-cv/bin/python -B scripts/prepare-sam3.py
npm run cv:start
npm start
```

Optional `SAM3_MODEL_PATH` points to an existing official snapshot; its weights
checksum is still required to match. Local SAM 3 defaults to CPU, four threads
(`CV_CPU_THREADS=1..8`). No dependencies are automatically upgraded by this change.

The canonical model lock is `services/cv_inference/sam3-model.json`.
Use `CV_MODEL_DEFAULT=sam3` and `SAM3_INFERENCE_URL` for a separate endpoint.
Remove retired `GROUNDED_SAM2_INFERENCE_URL` / `SAM2_*` settings.
An obsolete default key falls back to the current default, but explicit execution
of a retired key is rejected. Old persisted records are never rewritten.

A new photo runs only the selected model. Switching models on the same photo
retains completed results for comparison; switching photos discards them. The
earlier A/B harness intentionally requires its recorded base application commit
to rerun SAM 2, because the current branch no longer contains that implementation.

## Release Barrier

The public deployment is unchanged until a separate authorized release.
Do not deploy only the new web source against the existing SAM 2 Space.

1. Package with `npm run package:hf`; review the code-only allowlist and hashes.
2. After permission, prepare a SAM 3 ZeroGPU Space with a private `HF_TOKEN`
   approved for gated reads. Never bundle weights or put this token in source.
3. Verify real CUDA inference, multiple masks, empty results, quota failures,
   raw scores and pinned provenance on the hosted service.
4. After permission, publish/review the GitHub branch and deploy the matching
   Vercel source with `SAM3_INFERENCE_URL` pointing to the tested service.
5. Verify public configuration, EN/RU, one real upload, workspace HTTP 403,
   static resources and precomputed examples. No production DB writes.
6. Keep rollback available; hosted SAM 2 resource deletion requires approval.

The public backend rejects old model keys or a mismatched revision/hash instead
of presenting them as SAM 3. On failure it returns an error; precomputed demos
remain explicitly separate.

## Validation Interpretation

The earlier local A/B experiment used three curated originals and two clearly
derived controls. It motivates this product choice but does not prove universal
accuracy. The checked-in benchmark retains historical SAM 2 reference masks.
Its default execution model is now SAM 3; existing strict similarity gates may
fail because outputs changed. Do not lower gates or relabel references merely
to obtain green. Independent accuracy evaluation requires human ground truth.

The local migration run completed all three historical cases. Aggregate Dice
was 0.608880 and IoU 0.441582 against unchanged SAM 2 references; the historical
gate did not pass. This is recorded cross-model drift, not an independent model
accuracy measurement. The deterministic application verification and the five
exact-mask SAM 3 adapter checks passed separately.

Meta model documentation: https://huggingface.co/docs/transformers/en/model_doc/sam3
Model/license: https://huggingface.co/facebook/sam3
