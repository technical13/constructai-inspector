# Performance Guardrails

## O(n²) Awareness

- avoid nested scans across all defects and all reports inside hot UI paths
- connected-component logic in Python must stay linear in positive mask pixels as much as possible

## Blocking Call Prevention

- do not place long-running CV inference inside the synchronous web request path without explicit timeout strategy
- do not add blocking filesystem loops in request handlers

## Memory Growth Control

- avoid keeping large image data URLs alive longer than needed in browser state
- avoid duplicating full image payloads across multiple in-memory structures

## Data Loop Safeguards

- report generation must work from stored records, not repeatedly rehydrate raw uploads
- storage lookups must not rescan entire unrelated datasets in hot paths when avoidable

## Ranking / Data Processing Safeguards

- CV post-processing must filter tiny noisy components
- nearby zones may be merged only when the merge reduces false fragmentation more than it increases false area
- if a model is noisy, prefer conservative boxes over misleading pseudo-precision

Performance regression is treated as failure if it materially degrades capture, defect review, or report generation.
