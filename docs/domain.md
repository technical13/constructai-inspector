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
