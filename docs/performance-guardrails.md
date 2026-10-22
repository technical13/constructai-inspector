# Performance Guardrails

## O(n²) Awareness

- avoid nested scans across all defects and all reports inside hot UI paths
- connected-component logic in Python must stay linear in positive mask pixels as much as possible

## Blocking Call Prevention

- all external CV calls pass through the bounded inference gateway
- default active concurrency is one request per endpoint, with a finite queue and 120-second deadline
- Python CV runtime independently limits direct concurrent callers and lazy-loads each model
- do not add blocking filesystem loops in request handlers

## Memory Growth Control

- avoid keeping large image data URLs alive longer than needed in browser state
- avoid duplicating full image payloads across multiple in-memory structures
- run the selected adapter only for a new photo; auxiliary comparisons are
  explicit, on-demand operations on that same photo, not automatic model fan-out
- SAM 3 restores one instance at a time, caps candidate masks at 64 and input at
  12 million pixels; preserve all instances below the cap and reject overflow
- do not add cosmetic mask dilation/smoothing to SAM 3 or call it improved accuracy

## Data Loop Safeguards

- report generation must work from stored records, not repeatedly rehydrate raw uploads
- storage lookups must not rescan entire unrelated datasets in hot paths when avoidable

## Ranking / Data Processing Safeguards

- CV post-processing must filter tiny noisy components
- nearby zones may be merged only when the merge reduces false fragmentation more than it increases false area
- if a model is noisy, prefer conservative boxes over misleading pseudo-precision

Performance regression is treated as failure if it materially degrades capture, defect review, or report generation.
