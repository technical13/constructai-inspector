import { getStorageBackend } from "./runtime-config.js"

import * as localStore from "./local-store.js"
import * as postgresStore from "./postgres-store.js"

const store = getStorageBackend() === "postgres" ? postgresStore : localStore

export const storageBackend = getStorageBackend()

export const {
  createDefect,
  createProject,
  createReport,
  createSession,
  deleteDefect,
  getBootstrapData,
  getMediaAsset,
  getReportDocument,
  getSessionBundle,
  reanalyseDefect,
  updateDefect
} = store
