import { spawn } from "node:child_process"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const runDir = path.join(root, "logs", `evidence-${new Date().toISOString().replace(/[:.]/g, "-")}`)
await mkdir(runDir, { recursive: true })
console.log(`Evidence directory: ${runDir}`)
console.log("Isolated local demonstration. All entered project/session data must be fictional.")
const child = spawn(process.execPath, ["src/server.js"], {
  cwd: root,
  env: {
    ...process.env,
    PORT: process.env.PORT || "3100",
    HOST: "127.0.0.1",
    STORAGE_BACKEND: "local",
    DATABASE_URL: "", POSTGRES_URL: "", BLOB_READ_WRITE_TOKEN: "",
    CONSTRUCTAI_DATA_DIR: path.join(runDir, "runtime"),
    DEMO_LIBRARY_WRITABLE: "false",
    CV_INFERENCE_MODE: "disabled"
  },
  stdio: "inherit"
})
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal))
}
child.on("exit", (code) => { process.exitCode = code || 0 })
