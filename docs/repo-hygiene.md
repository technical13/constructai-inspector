# Repository Hygiene

## Rules

- keep generated media and reports out of version control
- keep heavy model weights and virtual environments out of version control
- update docs whenever runtime contracts or verify commands change
- prefer small, reviewable changes over broad rewrites
- do not mix UI redesign, storage mutation, and CV changes unless necessary

## Ignored Runtime Artifacts

- `node_modules/`
- `.venv-cv/`
- `services/cv_inference/models/`
- `services/cv_inference/__pycache__/`
- `data/uploads/`
- `data/reports/`
- `logs/*` except `logs/.gitkeep`

## Hygiene Trigger

Any change that touches persistence, report rendering, or inference contracts must also update the relevant docs under `docs/`.
