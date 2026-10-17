# Next Safe Tasks

1. Create independent human masks for the three benchmark images and add an accuracy-eligible manifest without replacing the regression baseline.
2. Investigate the `branching-crack` classification mismatch where Grounded SAM 2 reproduces the mask but returns `corrosion` instead of `crack`.
3. Review the three orphan uploads reported by `npm run audit`; delete them only after manual visual confirmation or backup.
4. Publish the explicit-review remediation only after separate production authorization; then smoke-test the public demo without modifying historical data.
5. Extend storage parity coverage to failure cleanup and future schema migrations; current review/create/edit/reanalysis/report API parity is covered on filesystem and disposable local Postgres.
6. Grant the Vercel GitHub App repository access only as part of the separately authorized deployment workflow.
