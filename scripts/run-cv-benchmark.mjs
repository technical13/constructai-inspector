import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const venvPython = path.join(rootDir, ".venv-cv", "bin", "python")
const python = existsSync(venvPython) ? venvPython : "python3"
const result = spawnSync(
  python,
  ["-B", path.join(rootDir, "scripts", "cv_benchmark.py"), ...process.argv.slice(2)],
  {
    cwd: rootDir,
    stdio: "inherit"
  }
)

if (result.error) {
  console.error(`benchmark: unable to start Python: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
