# Verify Prompt

Run the deterministic repository baseline:

1. `npm run lint`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`

If any step fails:

- fix the smallest safe surface
- rerun the full sequence
- report residual risk, not only the fixed symptom
