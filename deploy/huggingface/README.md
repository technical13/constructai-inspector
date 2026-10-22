---
title: ConstructAI Inspector CV
sdk: gradio
sdk_version: 6.30.0
python_version: 3.12.12
app_file: app.py
short_description: Live text-prompted crack segmentation with SAM 3
tags:
  - computer-vision
  - crack-segmentation
  - sam3
models:
  - facebook/sam3
---

# ConstructAI Inspector CV

Live inference companion for [ConstructAI Inspector](https://github.com/technical13/constructai-inspector).
Upload a new concrete-surface photo to run pretrained Meta SAM 3 with the fixed
prompt `crack in concrete`, without a separate detector. Results
are computed on demand; this Space does not replay saved demo masks.

The main [web application](https://constructai-inspector.vercel.app/) remains a
separate deployment. Its precomputed Demo Mode is not switched to live inference
by publishing this Space.

## Limits and Interpretation

- This experimental Space uses shared ZeroGPU compute, daily quotas, and a queue.
- It accepts PNG/JPEG/WebP images up to 12 MiB and 12 million decoded pixels.
- Images are resized to a maximum side of 1600 pixels before inference.
- One analysis runs at a time; at most four additional jobs may wait.
- Model score is not independently validated accuracy or a calibrated probability.
- A negative result does not establish that a surface is free of cracks.
- All results require human review and are not validated structural-safety assessments.
- Upload only non-sensitive images you are authorized to share with Hugging Face.
- Gradio may cache uploads/results temporarily; scheduled cleanup is not a
  privacy guarantee. No project/session database or report archive is hosted here.

## API

The queued Gradio endpoint is `/infer`. Input is one JSON object containing
`imageDataUrl` (base64 PNG/JPEG/WebP) and optional `modelKey` (`sam3`).
Retired model keys are rejected, not aliased. The output is `{ "suggestion": ... }`, compatible with the web
application's inference contract. All suggestions remain `pending_review`.

Use the Space's **Use via API** documentation for the exact endpoint URL.
When a backend uses one Hugging Face token, calls consume that account's shared
quota; they do not receive a fresh free allowance for every website visitor.

## Reproducibility

`models.json` pins the SAM 3 revision and weights SHA-256.
`build-info.json` records the source revision and artifact hashes.
The models are pretrained third-party models, not an independently validated
construction-safety system.

## Gated Weights

The Space owner must first obtain access to [facebook/sam3](https://huggingface.co/facebook/sam3)
and follow the [Meta SAM license](https://huggingface.co/facebook/sam3/blob/main/LICENSE).
Set `HF_TOKEN` only as a Space **secret**, with read access to approved public
gated repositories. The model is downloaded and its checksum verified at startup.
Weights and credentials are never bundled in this public source package.
This secret is separate from the Vercel token used to call the queued API.
No visitor needs a Hugging Face token; visitors share the configured server quota.
