# Reproducible Evidence Capture

Use the current application with fictional data. These captures establish the
prototype workflow, not independent model accuracy, field deployment, or a
structural safety conclusion. Never replace the earlier October 17, 2026 archive.

## Start

1. Run `npm run verify`; optional Postgres parity testing uses the guarded local
   `TEST_DATABASE_URL` described in `docs/testing.md`.
2. Record the code commit (`git rev-parse HEAD`) and a clean worktree.
3. Run `npm run evidence:serve`. It prints a unique output directory and starts
   the actual application on `http://127.0.0.1:3100`. The server uses local storage
   only, never the configured cloud database. Inference is disabled explicitly.
4. Use a fresh browser context, English UI, desktop viewport 1440 x 900, DPR 1
   or a recorded higher value. Wait for fonts and images to finish loading.
5. Capture raw browser PNGs; preserve originals. Ordinary scrolling and optional
   extra full-page captures are allowed. Do not edit screenshot text or DOM.

## Scenario And File Names

| File | Actual application state |
| --- | --- |
| `01-project-setup.png` | New project form filled, before submitting. |
| `02-inspection-session.png` | Session form filled, before submitting. |
| `03-demo-mode.png` | Demo picker and Precomputed AI results disclosure. |
| `04-ai-suggestion.png` | Loaded curated image, saved mask, Model score, pending decision. |
| `05-human-review.png` | Keep manual chosen; Manual selection indicator visible. |
| `06-saved-defect.png` | Saved/reloaded defect, Manual selection, same crack type. |
| `07-generated-report.png` | Report generation succeeded; generated report link visible. |
| `08-html-report.png` | Real saved English HTML document, Manual selection and photo. |

Use `Fictional Demo Project E-9`, address `Demo data - no real construction site`,
inspector `Demo Operator (fictional)`, session note `Fictional inspection for
software demonstration only`, area `Demo panel A (fictional)`. Comment:
`Demo image of a concrete crack. Manual type selection for software demonstration; no field inspection or safety assessment.`

The photo must be selected from the repository's curated demo library. Keep its
original mask/score. The main code tags the result `precomputed_demo`; do not
call inference to stage a result. If a label is part of a source photograph,
preserve that source image. Programmatic SVG labels use the selected UI/report
locale and do not change the underlying raster file.

Also check 390 x 844 and 768 x 1024 layouts, page overflow, original photo ratio,
controls, report generation, and browser console errors. Record exact viewports,
browser version, time zone, DPR and capture time in `browser-environment.json`.
Store notes in `capture-notes.md`, including the local URL, source commit and
limitations. Save the original generated HTML and saved snapshot if needed;
do not rewrite the HTML to make a screenshot look different.

## Hash Manifest

After all artifacts have been saved:

```bash
npm run evidence:manifest -- logs/evidence-<unique-run>
```

The command refuses to overwrite an existing manifest. It records SHA-256,
PNG dimensions, file times, Git SHA, source worktree status, and Node/platform
metadata. `logs/` is ignored by Git and excluded from Vercel. Archive the complete
directory locally. Nothing is uploaded to Drive, USCIS, GitHub or Vercel.

If browser automation is unavailable, follow these steps manually and label the
capture status as pending; do not claim that screenshots exist.
