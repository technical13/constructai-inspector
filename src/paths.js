import path from "node:path"
import { fileURLToPath } from "node:url"

const srcDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(srcDir, "..")

export const paths = {
  appRoot,
  publicDir: path.join(appRoot, "public"),
  dataDir: path.join(appRoot, "data"),
  uploadsDir: path.join(appRoot, "data", "uploads"),
  reportsDir: path.join(appRoot, "data", "reports"),
  storeFile: path.join(appRoot, "data", "store.json")
}
