# Domain

## Entities

### Project

- identity: inspection context
- mutable fields: `name`, `address`, `description`

### Session

- identity: bounded inspection run for one project
- mutable fields: `inspectorName`, `sessionNote`

### Defect

- identity: persisted observation with photo
- required fields: `sessionId`, `defectType`, `comment`, `photos[0]`
- optional fields: `locationDescription`, `aiSuggestion`, `engineeringEvaluation`

### Report

- identity: immutable snapshot document generated from stored session state
- required fields: `sessionId`, `snapshot`, `generatedDocument`, `version`

## Flow

1. project selected
2. session opened
3. photo captured
4. AI optionally suggests
5. operator confirms or corrects
6. defect persisted
7. report generated from saved defects

## Domain Discipline

- defects belong to exactly one session
- reports are derived artifacts, not editable source records
- AI suggestion is metadata around a defect, not a defect replacement

## Human Review Contract (Version 1)

New `aiSuggestion` JSON includes `suggestionId`, `analysisMode`, `review`, and
`typeMatchesSuggestion`. `review = { version: 1, decision, reviewedAt }` is the
authoritative human action; `status` mirrors it for old consumers. No database
column migration is required.

| Decision | Meaning |
| --- | --- |
| `accepted` | Operator explicitly chose Accept type; final type matches suggestion. |
| `corrected` | Operator changed the type away from the model suggestion. |
| `manual` | Operator chose Keep manual, even if the type happens to match. |
| `pending_review` | No current explicit decision; includes every fresh reanalysis. |

No suggestion means Manual entry. Legacy JSON without `review.version=1` is
displayed as Review not recorded (legacy), except an already pending suggestion.
Comment-only edits preserve its raw legacy JSON. A type edit is a new action and
can create a versioned review; it does not retroactively establish earlier consent.

Changing a manually selected type preserves `manual`. Changing an accepted type
invalidates acceptance; restoring the suggested type does not restore consent.
UI, API and report share the pure contract in `public/ai-review.js`.
