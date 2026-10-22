# Next Safe Tasks

1. Create independent human masks for the three benchmark images and add an accuracy-eligible manifest without replacing the regression baseline.
2. Authorize and test a coordinated SAM 3 Hugging Face/Vercel release only after gated-read Space secret setup; the old SAM 2 inference code is retired locally, not silently relabeled in production.
3. Review the three orphan uploads reported by `npm run audit`; delete them only after manual visual confirmation or backup.
4. Publish the explicit-review remediation only after separate production authorization; then smoke-test the public demo without modifying historical data.
5. Extend storage parity coverage to failure cleanup and future schema migrations; current review/create/edit/reanalysis/report API parity is covered on filesystem and disposable local Postgres.
6. Grant the Vercel GitHub App repository access only as part of the separately authorized deployment workflow.
