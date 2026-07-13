import { execFileSync } from "node:child_process"

const ignoredRoots = new Set([
  ".venv-cv",
  "node_modules",
  "data/uploads",
  "data/reports",
  "services/cv_inference/models"
])

function listFiles(args) {
  const output = execFileSync("find", args, { encoding: "utf8" }).trim()
  return output === "" ? [] : output.split("\n")
}

function isIgnored(filePath) {
  const normalized = filePath.replace(/^\.\//, "")
  return [...ignoredRoots].some(
    (root) => normalized === root || normalized.startsWith(`${root}/`)
  )
}

const dsStoreFiles = listFiles([".", "-name", ".DS_Store", "-type", "f"]).filter(
  (file) => !isIgnored(file)
)
const pyCacheDirs = listFiles([".", "-name", "__pycache__", "-type", "d"]).filter(
  (file) => !isIgnored(file)
)
const pycFiles = listFiles([".", "-name", "*.pyc", "-type", "f"]).filter(
  (file) => !isIgnored(file)
)
const temporaryFiles = listFiles([".", "-name", "*.tmp", "-type", "f"]).filter(
  (file) => !isIgnored(file)
)
const deletionTombstones = listFiles([
  ".",
  "-name",
  "*.delete-tmp",
  "-type",
  "f"
]).filter((file) => !isIgnored(file))

const violations = [
  ...dsStoreFiles,
  ...pyCacheDirs,
  ...pycFiles,
  ...temporaryFiles,
  ...deletionTombstones
]

if (violations.length > 0) {
  console.error("hygiene: local garbage found in source-controlled areas")
  for (const violation of violations) {
    console.error(`- ${violation}`)
  }
  process.exit(1)
}

console.log("hygiene: source-controlled areas are free of local garbage")
