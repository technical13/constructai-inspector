import { access, readFile } from "node:fs/promises"
import { constants } from "node:fs"

const requiredFiles = [
  "public/index.html",
  "public/app.css",
  "public/app.js",
  "src/server.js",
  "src/api-handler.js",
  "src/report.js",
  "api/index.js",
  "vercel.json"
]

for (const file of requiredFiles) {
  await access(new URL(`../${file}`, import.meta.url), constants.R_OK)
}

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8")
const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"))

if (!html.includes('src="/app.js"')) {
  throw new Error("build: public/index.html does not reference /app.js")
}

if (!vercel.rewrites && !vercel.routes) {
  throw new Error("build: vercel.json has no routing configuration")
}

console.log("build: runtime assets and deployment manifest are present")
