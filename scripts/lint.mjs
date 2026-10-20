import { execFileSync } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

async function collectFiles(relativeDir, extensions) {
  const absoluteDir = path.join(rootDir, relativeDir)
  const entries = await fs.readdir(absoluteDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name)

    if (entry.isDirectory()) {
      if (entry.name === "__pycache__") {
        continue
      }
      files.push(...(await collectFiles(relativePath, extensions)))
      continue
    }

    if (extensions.has(path.extname(entry.name))) {
      files.push(relativePath)
    }
  }

  return files
}

const jsFiles = (
  await Promise.all(
    ["api", "public", "scripts", "src", "test"].map((dir) =>
      collectFiles(dir, new Set([".js", ".mjs"]))
    )
  )
).flat().sort()
const pyFiles = await collectFiles(
  path.join("services", "cv_inference"),
  new Set([".py"])
)
pyFiles.push(...await collectFiles(path.join("deploy", "huggingface"), new Set([".py"])))

const pythonSyntaxCheck = `
import pathlib
import sys

for file_name in sys.argv[1:]:
    path = pathlib.Path(file_name)
    compile(path.read_text(encoding="utf-8"), str(path), "exec")
`

for (const file of jsFiles) {
  execFileSync("node", ["--check", file], { cwd: rootDir, stdio: "inherit" })
}

for (const file of pyFiles) {
  execFileSync("python3", ["-B", "-c", pythonSyntaxCheck, file], {
    cwd: rootDir,
    stdio: "inherit"
  })
}

console.log(
  `lint: syntax valid for ${jsFiles.length} JavaScript and ${pyFiles.length} Python files`
)
