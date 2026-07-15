# Specs

## Product Frame

ConstructAI Inspector is a mobile-first web application for construction defect capture, structured description, and act generation. The deterministic core must remain useful without AI. AI is an assistive layer, not the source of truth.

## Current MVP0 Scope

- choose or create a project
- open an inspection session
- upload a defect photo
- choose and describe a defect
- save the defect into persistent storage
- generate a reproducible report from stored snapshot data

## Current V2 Scope

- ask AI for a preliminary defect type
- display one or more attention zones on the photo
- compare configured pretrained models on the same photo
- require human confirmation or correction before persistence

## Explicit Non-Goals

- autonomous final engineering judgement
- legal or normative decision automation
- BIM/CAD integration
- enterprise auth/permissions
- video inspection
- autonomous model ranking without a labeled validation set

## Deterministic Requirements

- no report from transient UI state
- no saved defect without photo
- no AI suggestion promoted to final fact without human-reviewed persistence
- no hidden mode switch that makes the app unusable when CV is offline
