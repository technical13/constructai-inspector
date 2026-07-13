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
