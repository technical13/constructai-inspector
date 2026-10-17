import path from "node:path"
import { fileURLToPath } from "node:url"

const srcDir = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.resolve(srcDir, "..")
const dataDir = process.env.CONSTRUCTAI_DATA_DIR
  ? path.resolve(process.env.CONSTRUCTAI_DATA_DIR)
  : path.join(appRoot, "data")

export const paths = {
  appRoot,
  publicDir: path.join(appRoot, "public"),
  dataDir,
  uploadsDir: path.join(dataDir, "uploads"),
  reportsDir: path.join(dataDir, "reports"),
  storeFile: path.join(dataDir, "store.json")
}
