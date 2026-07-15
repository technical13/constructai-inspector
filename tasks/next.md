# Next Safe Tasks

1. Create independent human masks for the three benchmark images and add an accuracy-eligible manifest without replacing the regression baseline.
2. Investigate the `branching-crack` classification mismatch where Grounded SAM 2 reproduces the mask but returns `corrosion` instead of `crack`.
3. Review the three orphan uploads reported by `npm run audit`; delete them only after manual visual confirmation or backup.
4. Add temp-directory integration tests for local-store mutation and report/media access.
5. Add deterministic Postgres migration and storage-adapter parity tests.
6. Grant the Vercel GitHub App access to `technical13/constructai-inspector` and enable automatic production deployments from `main`.
