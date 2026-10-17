import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { readFile, readdir, stat, writeFile } from "node:fs/promises"
import path from "node:path"

const directory = process.argv[2]
if (!directory) throw new Error("Usage: npm run evidence:manifest -- <new evidence directory>")
const root = path.resolve(directory)
const manifestPath = path.join(root, "sha256-manifest.json")
try {
  await stat(manifestPath)
  throw new Error("Refusing to overwrite an existing evidence manifest.")
} catch (error) {
  if (error.code !== "ENOENT") throw error
}
const files = []
for (const name of (await readdir(root)).sort()) {
  const filePath = path.join(root, name)
  const metadata = await stat(filePath)
  if (!metadata.isFile()) continue
  const bytes = await readFile(filePath)
  files.push({
    name, bytes: bytes.length,
    capturedOrSavedAt: metadata.mtime.toISOString(),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...(name.endsWith(".png") ? { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) } : {})
  })
}
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceWorktreeStatus: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  note: "Original browser screenshots and saved artifacts. See browser-environment.json and capture-notes.md for scenario and viewport details.",
  files
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" })
console.log(manifestPath)
