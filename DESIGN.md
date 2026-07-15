# ConstructAI Inspector Design Contract

> A calibrated inspection instrument: Braun restraint, Swiss-Bauhaus structure,
> concrete-toned materials, and one high-visibility analysis signal.

## Intent

The interface must feel like an engineering tool rather than a generic SaaS
dashboard. Every element has a job, hierarchy comes from alignment and type,
and the photographed defect remains the dominant visual object.

The system is adapted from the Braun/Dieter Rams principles already established
for the product, with Yllw and Index from Refero Styles used as supporting
references. It is not a reproduction of either source.

References:

- https://styles.refero.design/style/9483a10e-e098-4f94-ae22-ab5a63702243
- https://styles.refero.design/style/b1ec2120-ceb0-42d1-9f96-2c9db2bf009b

## Principles

1. **Useful before expressive.** The next action and current state are always obvious.
2. **Flat by construction.** Borders, adjacency, and tonal shifts create hierarchy; shadows do not.
3. **Signal, do not decorate.** Yellow marks CV evidence, active progress, and the primary action only.
4. **One screen, one decision.** Secondary input stays collapsed until requested.
5. **Photography is evidence.** Never crop or decorate it in a way that obscures the defect.
6. **AI stays reviewable.** Model output must look provisional until the operator confirms it.
7. **Report parity.** The exported act uses the same type, geometry, and evidence treatment.

## Tokens

### Color

| Token | Value | Role |
| --- | --- | --- |
| `canvas` | `#d5d1c4` | Outer application background; warm equipment casing |
| `paper` | `#f3f1e8` | Main working plane |
| `surface` | `#fbfaf5` | Inputs and primary content surfaces |
| `surface-muted` | `#e8e5da` | Secondary groups and disabled controls |
| `ink` | `#151718` | Primary text and structural controls |
| `graphite` | `#3e413e` | Secondary text and dark panels |
| `muted` | `#71736d` | Metadata and supporting copy |
| `line` | `#bbb7aa` | Standard hairline |
| `line-strong` | `#151718` | Active boundaries and focus structure |
| `signal` | `#f2e600` | CV masks, active progress, primary action |
| `success` | `#3f5b43` | Confirmed positive state only |
| `error` | `#934936` | Blocking error state only |

Rules:

- Yellow is never used for large decorative backgrounds.
- Green and red are semantic, not brand colors.
- No gradients. No blurred shadows. No glass effects.
- Photo overlays may use translucent ink for legibility.

### Typography

- UI and headings: `IBM Plex Sans`, weights 300, 400, 500, 600.
- Labels and metadata: `IBM Plex Mono`, weights 400, 500, 600.
- Do not introduce a third family.
- Headings use light or medium weight with tight tracking; hierarchy comes from scale.
- Labels are compact uppercase with deliberate tracking.

| Role | Size | Line height | Weight |
| --- | --- | --- | --- |
| Page title | `clamp(2.25rem, 7vw, 4.25rem)` | `0.92` | `500` |
| Section title | `1.35rem` | `1.05` | `500` |
| Body | `0.95rem` | `1.5` | `400` |
| Label | `0.68rem` | `1.2` | `600` mono |
| Metadata | `0.74rem` | `1.35` | `500` mono |

### Grid And Spacing

- Base unit: `4px`.
- Content width: `920px` maximum.
- Standard gaps: `8px`, `12px`, `16px`, `24px`, `32px`.
- Touch target: at least `48px`.
- Desktop uses a 12-column mental grid; forms remain a single reading column.
- Mobile keeps 16px outer gutters and never introduces horizontal page scrolling.

### Shape

- Controls: `2px` radius.
- Cards and panels: `4px` radius.
- Main shell and media: `6px` maximum.
- Pills are prohibited except where the shape communicates a compact status.
- Borders are `1px`; active/focus boundaries may use `2px` or an outer focus ring.

## Components

### Masthead

- Quiet horizontal instrument label, not a hero banner.
- Existing product mark is preserved.
- Language control is a compact rectangular segmented switch.

### Step Rail

- Lives on the dark calibration panel.
- Active step is signalled with yellow, completed steps with ink/white contrast.
- Locked steps remain readable but visually recede.
- The title remains the dominant element; helper copy is one short line.

### Panels

- One structural border per meaningful group.
- Avoid card-inside-card styling. Nested groups use a top rule or tonal shift.
- Section labels align to the same left edge.

### Inputs

- White matte surface, 1px border, 48px minimum height.
- Focus uses a sharp ink/yellow outline, never a soft glow.
- Placeholder text remains legible and visibly secondary.

### Buttons

- Primary: signal yellow, black text, black border.
- Secondary: ink fill, light text.
- Plain: transparent or paper fill with ink border.
- Press interaction moves down by `2px` and removes the hard offset.
- Disabled controls use muted surface and must not resemble active primary actions.

### Image Analysis

- The main image is the largest object on the defect screen.
- Grounded SAM mask stays high-visibility yellow with controlled glow only on reveal.
- Model name and defect label remain small, rectangular, and peripheral.
- Comparison outputs are subordinate and never compete with the main mask.
- Reduced-motion users receive the final mask immediately.

### Reports

- Reports use a paper-white plane, sharp rules, and the same typography.
- Summary data reads as a technical register, not a dashboard card grid.
- Defect evidence is never omitted from the generated report.
- Print mode removes casing colors while preserving rules and hierarchy.

## Motion

- Control response: `120-160ms`.
- Screen reveal: `180-240ms`.
- CV contour reveal: `360-700ms`, staged by region.
- Motion must communicate state change, analysis, or physical press.
- No ambient floating, looping decorative movement, or parallax.

## Accessibility

- Minimum body contrast: WCAG AA.
- Every interactive control retains a visible keyboard focus state.
- Color never carries status alone; labels and structure remain present.
- `prefers-reduced-motion` disables all non-essential reveal animation.
- Russian and English strings must fit without truncation at 320px width.

## Do Not

- Do not add large rounded cards, glassmorphism, soft drop shadows, or gradients.
- Do not use yellow as a general background or decorative flourish.
- Do not add explanatory text when hierarchy or labeling can make the action clear.
- Do not hide model provenance or present AI output as an engineering conclusion.
- Do not change domain flows, persistence, or report evidence for visual reasons.
