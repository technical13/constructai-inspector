import { access, readFile } from "node:fs/promises"
import { constants } from "node:fs"

const requiredFiles = [
  "DESIGN.md",
  "public/index.html",
  "public/app.css",
  "public/app.js",
  "public/ai-review.js",
  "public/try.html",
  "public/preview.css",
  "public/preview.js",
  "public/preview-contract.js",
  "src/public-preview.js",
  "src/server.js",
  "src/api-handler.js",
  "src/report.js",
  "src/inference-gateway.js",
  "benchmarks/cv/manifest.json",
  "api/index.js",
  "vercel.json",
  ".vercelignore"
]

for (const file of requiredFiles) {
  await access(new URL(`../${file}`, import.meta.url), constants.R_OK)
}

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8")
const css = await readFile(new URL("../public/app.css", import.meta.url), "utf8")
const design = await readFile(new URL("../DESIGN.md", import.meta.url), "utf8")
const benchmark = JSON.parse(
  await readFile(new URL("../benchmarks/cv/manifest.json", import.meta.url), "utf8")
)
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"))
const vercelIgnore = await readFile(new URL("../.vercelignore", import.meta.url), "utf8")

if (!html.includes('src="/app.js"')) {
  throw new Error("build: public/index.html does not reference /app.js")
}

if (!vercel.rewrites && !vercel.routes) {
  throw new Error("build: vercel.json has no routing configuration")
}

const previewHtml = await readFile(new URL("../public/try.html", import.meta.url), "utf8")
if (!previewHtml.includes('src="/preview.js"') || !previewHtml.includes('href="/preview.css"') ||
    !vercel.redirects?.some(rule => rule.source === "/" && rule.destination === "/try") ||
    !vercel.rewrites?.some(rule => rule.source === "/try" && rule.destination === "/try.html")) {
  throw new Error("build: public preview entry point or deployment route is missing")
}

for (const localOnlyPath of [
  ".env.*",
  ".venv-cv/",
  "services/cv_inference/models/",
  "data/"
]) {
  if (!vercelIgnore.split(/\r?\n/).includes(localOnlyPath)) {
    throw new Error(`build: .vercelignore must exclude ${localOnlyPath}`)
  }
}

if (!design.includes("# ConstructAI Inspector Design Contract")) {
  throw new Error("build: DESIGN.md does not expose the product design contract")
}

if (!css.includes("--signal: #f2e600")) {
  throw new Error("build: browser UI is not aligned with the design signal token")
}

if (benchmark.schemaVersion !== 1 || !Array.isArray(benchmark.cases)) {
  throw new Error("build: CV benchmark manifest contract is invalid")
}

console.log(
  "build: runtime assets, design contract, benchmark, and deployment manifest are present"
)
