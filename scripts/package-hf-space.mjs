import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { promises as fs } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const template = path.join(root, "deploy", "huggingface")
const modelLock = JSON.parse(await fs.readFile(path.join(template, "models.json"), "utf8"))
const sources = new Map([
  ["deploy/huggingface/app.py", "app.py"],
  ["deploy/huggingface/README.md", "README.md"],
  ["deploy/huggingface/requirements.txt", "requirements.txt"],
  ["deploy/huggingface/models.json", "models.json"],
  ["services/cv_inference/app.py", "services/cv_inference/app.py"],
  ["services/cv_inference/cloud_contract.py", "services/cv_inference/cloud_contract.py"],
  ["services/cv_inference/deepcrack_model.py", "services/cv_inference/deepcrack_model.py"],
  ["services/cv_inference/model_registry.py", "services/cv_inference/model_registry.py"],
  ["services/cv_inference/requirements.txt", "services/cv_inference/requirements.txt"],
  [modelLock.deepcrack.file, modelLock.deepcrack.file]
])

async function sha256(file) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest("hex")
}

const checkpoint = path.join(root, modelLock.deepcrack.file)
if (await sha256(checkpoint) !== modelLock.deepcrack.sha256) {
  throw new Error("DeepCrack checkpoint does not match deploy/huggingface/models.json")
}

await fs.mkdir(path.join(root, "logs"), { recursive: true })
const output = await fs.mkdtemp(path.join(root, "logs", "huggingface-space-"))
const files = []
for (const [source, destination] of sources) {
  const input = path.join(root, source)
  const stat = await fs.lstat(input)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`Refusing non-regular artifact source: ${source}`)
  }
  const target = path.join(output, destination)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.copyFile(input, target)
  files.push({ path: destination, bytes: stat.size, sha256: await sha256(target) })
}

const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()
const manifest = {
  sourceCommit: git("rev-parse", "HEAD"),
  workingTreeDirty: git("status", "--porcelain=v1") !== "",
  createdAt: new Date().toISOString(),
  hardware: "zero-gpu",
  files
}
await fs.writeFile(path.join(output, "build-info.json"), JSON.stringify(manifest, null, 2) + "\n")
console.log(JSON.stringify({ output, ...manifest }, null, 2))
