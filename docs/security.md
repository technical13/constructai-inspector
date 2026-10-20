# Security

## Current Posture

This repository is an MVP for inspection workflow and does not yet implement authentication or multi-user authorization. Treat all stored data as sensitive project information.

## Sensitive Surfaces

- defect photos
- generated reports
- project descriptions and addresses
- future engineering evaluation metadata

## Current Controls

- media/report paths are routed through controlled handlers
- request JSON size is bounded in the API handler
- file path resolution is guarded in the local server
- AI output is never treated as final truth without human confirmation
- public Vercel runtime exposes the checked-in demo library as read-only
- uploaded data URLs are restricted to supported raster image MIME types

## Current Gaps

- no auth layer
- no tenant isolation
- no encryption at rest beyond provider defaults
- no audit trail for user identity

## Security Rules

- do not broaden public storage exposure without explicit need
- do not log raw image payloads
- do not add hidden external inference dependencies
- prefer explicit config to implicit cloud calls
- ZeroGPU upload packages use an explicit file allowlist; never upload the working
  directory, local environment, project storage, evidence archives, or credentials
- cloud API tokens stay server-side; all requests share the token owner's quota
- public Gradio uploads/results can be temporarily cached; use non-sensitive photos

## Public Live Preview

- Vercel always blocks workspace read/write APIs before storage access; local
  public-mode servers also deny `/uploads/` and `/reports/` routes.
- Only explicit, consented JSON raster uploads reach the live model. Browser
  preprocessing strips metadata and resizes to 1600 px / 2 MiB; the server caps
  JSON at 3 MiB, validates MIME/magic/base64, and accepts only HTTPS `*.hf.space`.
- A single supported model is called once, without retries. Input SHA-256 and
  PNG mask dimensions are checked; provider text is not exposed to visitors.
- Same-origin checks, CSP, no-store responses, one active request per process,
  and a bounded burst guard reduce misuse. The guard is **not distributed**:
  serverless cold starts/regions do not share counters. HF's account quota is
  the hard global limit. This is a small public prototype, not abuse-proof hosting.
- Public images/results are not written to Postgres, Blob, local disk, browser
  storage, or the curated demo library by the preview. The providers may process
  and temporarily cache them; never promise zero retention across providers.
- Do not collect identity data, confidential site photos, or real-user project
  records in this unauthenticated preview.
