import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

export async function writeFileAtomic(filePath, data, options = "utf8") {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  )

  try {
    await fs.writeFile(temporaryPath, data, options)
    await fs.rename(temporaryPath, filePath)
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {})
  }
}
