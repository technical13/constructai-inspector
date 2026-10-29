# SAM 3 Demo Refresh And Photo Drops

Date: 2026-10-29. Risk: HIGH (new model-generated fixtures and file input path).

All four current library entries were recomputed by the real pinned SAM 3 CPU
adapter using the original image bytes. Photos, scenario IDs and order are unchanged.
Two pre-existing entries use identical photo bytes; they were retained, not counted
as independent evidence of model quality. No human accuracy validation is implied.

Each new suggestion records the model revision/weights SHA-256, input SHA-256,
dimensions, timestamp and raw native score. It is explicitly precomputed and
pending review, not accepted because the previous SAM 2 suggestion was accepted.
Old snapshots, reports, benchmark references and historical evidence are untouched.
The old library is recoverable from Git revision `0a3d917` and an ignored local
backup produced by the refresh tool.

To reproduce with approved gated access and the local CV environment:

```bash
.venv-cv/bin/python -B scripts/refresh-demo-sam3.py
```

This writes a candidate, original backup, masks and hash manifest into a new
`logs/demo-refresh-sam3-*` directory. Add `--write` to atomically replace the current
library only after every case produces a valid crack mask. A changed source photo
or library during inference prevents replacement. `SAM3_MODEL_PATH` may select an
existing official snapshot; its weights hash is still checked. No cloud quota is used.

Drag and drop is supported on the public photo area and local capture card. The
file chooser remains the keyboard/mobile alternative. Both paths accept exactly
one nonempty JPEG/PNG/WebP, at most 12 MiB. URLs/HTML, directories and multi-file
drops are rejected, not silently converted or fetched. Public input keeps the
existing 12-megapixel/1600-pixel resize and explicit sharing consent. Dropping a
new photo never triggers public inference or preserves old consent; it invalidates
older results. Local inference behavior is unchanged: it requests the selected model.
Photo drops outside the target cannot navigate away or start uploads.

No new dependencies, services, database schema, public workspace access or
automatic public demo editing are introduced.
