import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  getPhotoAssetId,
  getPhotoFileName
} from "../src/media-reference.js"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const errors = []
const warnings = []

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function readJson(relativePath) {
  const absolutePath = path.join(rootDir, relativePath)
  return JSON.parse(await fs.readFile(absolutePath, "utf8"))
}

async function collectFiles(relativeDir, extensions) {
  const absoluteDir = path.join(rootDir, relativeDir)
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(relativePath, extensions)))
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(relativePath)
    }
  }

  return files
}

function findDuplicates(values) {
  const seen = new Set()
  const duplicates = new Set()
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    }
    seen.add(value)
  }
  return [...duplicates]
}

function auditEntityLinks(store) {
  const collections = ["projects", "sessions", "defects", "reports"]
  for (const name of collections) {
    if (!Array.isArray(store[name])) {
      errors.push(`data/store.json: ${name} must be an array`)
      store[name] = []
    }

    const duplicateIds = findDuplicates(store[name].map((item) => item?.id).filter(Boolean))
    for (const id of duplicateIds) {
      errors.push(`data/store.json: duplicate ${name} id ${id}`)
    }
  }

  const projectIds = new Set(store.projects.map((item) => item.id))
  const sessionIds = new Set(store.sessions.map((item) => item.id))

  for (const session of store.sessions) {
    if (!projectIds.has(session.projectId)) {
      errors.push(`session ${session.id} references missing project ${session.projectId}`)
    }
  }

  for (const defect of store.defects) {
    if (!sessionIds.has(defect.sessionId)) {
      errors.push(`defect ${defect.id} references missing session ${defect.sessionId}`)
    }
    if (!Array.isArray(defect.photos) || defect.photos.length === 0) {
      errors.push(`defect ${defect.id} has no persisted photo`)
    }
  }

  for (const report of store.reports) {
    if (!sessionIds.has(report.sessionId)) {
      errors.push(`report ${report.id} references missing session ${report.sessionId}`)
    }
  }
}

async function auditLocalData() {
  const storePath = path.join(rootDir, "data", "store.json")
  if (!(await exists(storePath))) {
    return
  }

  let store
  try {
    store = await readJson(path.join("data", "store.json"))
  } catch (error) {
    errors.push(`data/store.json is unreadable: ${error.message}`)
    return
  }

  auditEntityLinks(store)

  const uploadDir = path.join(rootDir, "data", "uploads")
  const reportDir = path.join(rootDir, "data", "reports")
  const uploadFiles = (await exists(uploadDir)) ? await fs.readdir(uploadDir) : []
  const reportFiles = (await exists(reportDir)) ? await fs.readdir(reportDir) : []
  const uploadByAssetId = new Map(
    uploadFiles.map((fileName) => [path.parse(fileName).name, fileName])
  )
  const referencedAssets = new Set()
  const photoOwners = [
    ...store.defects.map((defect) => ({ owner: `defect ${defect.id}`, defect })),
    ...store.reports.flatMap((report) =>
      (report.snapshot?.defects || []).map((defect) => ({
        owner: `report ${report.id}`,
        defect
      }))
    )
  ]

  for (const { owner, defect } of photoOwners) {
    for (const photo of defect.photos || []) {
      const assetId = getPhotoAssetId(photo)
      const fileName = getPhotoFileName(photo, assetId)
      if (assetId) {
        referencedAssets.add(assetId)
      }

      const storedFile = fileName && uploadFiles.includes(fileName)
        ? fileName
        : uploadByAssetId.get(assetId)

      if (!storedFile && !/^https?:\/\//.test(photo.publicPath || "")) {
        errors.push(`${owner} references missing media ${assetId || photo.publicPath || "unknown"}`)
      }
    }
  }

  const orphanUploads = uploadFiles.filter(
    (fileName) => !referencedAssets.has(path.parse(fileName).name)
  )
  if (orphanUploads.length > 0) {
    warnings.push(`local data: ${orphanUploads.length} orphan upload(s): ${orphanUploads.join(", ")}`)
  }

  const referencedReports = new Set(
    store.reports.map((report) => report.generatedDocument?.fileName).filter(Boolean)
  )
  const missingReports = [...referencedReports].filter(
    (fileName) => !reportFiles.includes(fileName)
  )
  const orphanReports = reportFiles.filter((fileName) => !referencedReports.has(fileName))

  for (const fileName of missingReports) {
    errors.push(`report document is missing: ${fileName}`)
  }
  if (orphanReports.length > 0) {
    warnings.push(`local data: ${orphanReports.length} orphan report document(s)`)
  }
}

async function auditDemoLibrary() {
  const document = await readJson(path.join("public", "demo", "scenarios.json"))
  const scenarios = Array.isArray(document.scenarios) ? document.scenarios : []
  const imageDir = path.join(rootDir, "public", "demo", "images")
  const imageFiles = await fs.readdir(imageDir)
  const duplicateIds = findDuplicates(scenarios.map((scenario) => scenario?.id).filter(Boolean))

  for (const id of duplicateIds) {
    errors.push(`demo library has duplicate scenario id ${id}`)
  }

  const referencedImages = new Set()
  for (const scenario of scenarios) {
    if (!scenario?.id || !scenario?.title || !scenario?.suggestion?.visualEvidence) {
      errors.push(`demo library contains an invalid scenario record`)
      continue
    }

    const imageFileName = path.basename(scenario.imageUrl || "")
    referencedImages.add(imageFileName)
    if (!imageFileName || !imageFiles.includes(imageFileName)) {
      errors.push(`demo scenario ${scenario.id} references missing image ${imageFileName}`)
    }
  }

  const orphanImages = imageFiles.filter((fileName) => !referencedImages.has(fileName))
  if (orphanImages.length > 0) {
    warnings.push(`demo library: ${orphanImages.length} orphan image(s): ${orphanImages.join(", ")}`)
  }
}

async function auditSourceGraph() {
  const sourceFiles = (
    await Promise.all(
      ["api", "scripts", "src", "test"].map((dir) =>
        collectFiles(dir, new Set([".js", ".mjs"]))
      )
    )
  ).flat()
  sourceFiles.push(path.join("public", "app.js"))

  const sourceSet = new Set(sourceFiles.map((file) => path.normalize(file)))
  const entryFiles = new Set([
    path.join("api", "index.js"),
    path.join("src", "server.js"),
    path.join("public", "app.js"),
    ...sourceFiles.filter((file) => file.startsWith(`scripts${path.sep}`)),
    ...sourceFiles.filter((file) => file.startsWith(`test${path.sep}`))
  ])
  const visited = new Set()

  async function visit(relativeFile) {
    const normalizedFile = path.normalize(relativeFile)
    if (visited.has(normalizedFile) || !sourceSet.has(normalizedFile)) {
      return
    }
    visited.add(normalizedFile)

    const source = await fs.readFile(path.join(rootDir, normalizedFile), "utf8")
    const importPattern = /(?:import\s+(?:[^"']+?\s+from\s+)?|export\s+[^"']+?\s+from\s+)["']([^"']+)["']/g
    for (const match of source.matchAll(importPattern)) {
      if (!match[1].startsWith(".")) {
        continue
      }
      const importedFile = path.normalize(
        path.join(path.dirname(normalizedFile), match[1])
      )
      await visit(importedFile)
    }
  }

  for (const entryFile of entryFiles) {
    await visit(entryFile)
  }

  const unreachable = [...sourceSet].filter((file) => !visited.has(file))
  if (unreachable.length > 0) {
    warnings.push(`unreachable source module(s): ${unreachable.join(", ")}`)
  }
}

async function auditBrowserContracts() {
  const html = await fs.readFile(path.join(rootDir, "public", "index.html"), "utf8")
  const app = await fs.readFile(path.join(rootDir, "public", "app.js"), "utf8")
  const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])

  for (const id of findDuplicates(htmlIds)) {
    errors.push(`public/index.html has duplicate id ${id}`)
  }

  const selectorIds = [...app.matchAll(/querySelector\("#([^"]+)"\)/g)].map(
    (match) => match[1]
  )
  for (const id of selectorIds) {
    if (!htmlIds.includes(id)) {
      errors.push(`public/app.js expects missing DOM id ${id}`)
    }
  }

  const translationKeys = [
    ...html.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)
  ].map((match) => match[1])
  for (const key of new Set(translationKeys)) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const occurrences = app.match(new RegExp(`"${escapedKey}"\\s*:`, "g")) || []
    if (occurrences.length < 2) {
      errors.push(`translation key ${key} is not defined for both locales`)
    }
  }
}

if (!(await exists(path.join(rootDir, ".git")))) {
  warnings.push("Git metadata is absent; history and tracked-file hygiene cannot be audited")
}

await auditSourceGraph()
await auditBrowserContracts()
await auditDemoLibrary()
await auditLocalData()

for (const warning of warnings) {
  console.warn(`audit warning: ${warning}`)
}
for (const error of errors) {
  console.error(`audit error: ${error}`)
}

if (errors.length > 0) {
  process.exit(1)
}

console.log(`audit: passed with ${warnings.length} warning(s)`)
