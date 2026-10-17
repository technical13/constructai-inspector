import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import { AppError } from "./app-error.js"
import { writeFileAtomic } from "./atomic-file.js"
import {
  createDefectRecord,
  createProjectRecord,
  createReportRecord,
  createSessionRecord,
  updateDefectRecord
} from "./domain.js"
import { parseImageDataUrl } from "./image-data.js"
import { finalizeAiSuggestion, suggestDefectFromImage } from "./inference.js"
import {
  getMimeTypeFromFileName,
  getPhotoAssetId,
  getPhotoFileName
} from "./media-reference.js"
import { paths } from "./paths.js"
import { buildReportSnapshot, renderReportHtml } from "./report.js"

const emptyStore = {
  projects: [],
  sessions: [],
  defects: [],
  reports: []
}

let mutationQueue = Promise.resolve()

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

async function ensureStorage() {
  await fs.mkdir(paths.dataDir, { recursive: true })
  await fs.mkdir(paths.uploadsDir, { recursive: true })
  await fs.mkdir(paths.reportsDir, { recursive: true })

  try {
    await fs.access(paths.storeFile)
  } catch {
    await writeFileAtomic(
      paths.storeFile,
      `${JSON.stringify(emptyStore, null, 2)}\n`,
      "utf8"
    )
  }
}

async function readStore() {
  await ensureStorage()
  const raw = await fs.readFile(paths.storeFile, "utf8")
  const parsed = JSON.parse(raw)

  return {
    projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    defects: Array.isArray(parsed.defects) ? parsed.defects : [],
    reports: Array.isArray(parsed.reports) ? parsed.reports : []
  }
}

async function persistStore(store) {
  await writeFileAtomic(
    paths.storeFile,
    `${JSON.stringify(store, null, 2)}\n`,
    "utf8"
  )
}

async function withMutableStore(mutator) {
  const run = mutationQueue.then(async () => {
    const store = await readStore()
    const result = await mutator(store)
    await persistStore(store)
    return result
  })

  mutationQueue = run.catch(() => {})
  return run
}

function sortByCreatedAt(items) {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt))
}

function requireEntity(entity, message) {
  if (!entity) {
    throw new AppError(404, message)
  }

  return entity
}

async function savePhoto(dataUrl) {
  const parsed = parseImageDataUrl(dataUrl)
  const photoId = randomUUID()
  const fileName = `${photoId}.${parsed.extension}`
  const absolutePath = path.join(paths.uploadsDir, fileName)

  await fs.writeFile(absolutePath, parsed.buffer)

  return {
    id: photoId,
    fileName,
    mimeType: parsed.mimeType,
    publicPath: `/api/media/${encodeURIComponent(photoId)}`,
    createdAt: new Date().toISOString()
  }
}

function findPhotoById(store, assetId) {
  for (const defect of store.defects) {
    const match = defect.photos.find((photo) => getPhotoAssetId(photo) === assetId)
    if (match) {
      return match
    }
  }

  for (const report of store.reports) {
    const reportDefects = Array.isArray(report.snapshot?.defects) ? report.snapshot.defects : []

    for (const defect of reportDefects) {
      const match = Array.isArray(defect.photos)
        ? defect.photos.find((photo) => getPhotoAssetId(photo) === assetId)
        : null

      if (match) {
        return match
      }
    }
  }

  return null
}

async function resolvePhotoFileName(photo, assetId) {
  const candidate = getPhotoFileName(photo, assetId)

  if (candidate) {
    try {
      await fs.access(path.join(paths.uploadsDir, candidate))
      return candidate
    } catch {
      // Legacy report snapshots may only retain the public media URL.
    }
  }

  const files = await fs.readdir(paths.uploadsDir)
  return files.find((fileName) => path.parse(fileName).name === assetId) || ""
}

function toImageDataUrl(photo, body) {
  return `data:${photo.mimeType};base64,${body.toString("base64")}`
}

export async function getBootstrapData() {
  const store = await readStore()

  return {
    projects: sortByCreatedAt(store.projects)
  }
}

export async function createProject(input) {
  const now = new Date().toISOString()
  const project = createProjectRecord(input, now)

  return clone(
    await withMutableStore(async (store) => {
      store.projects.push(project)
      return project
    })
  )
}

export async function createSession(input) {
  return clone(
    await withMutableStore(async (store) => {
      requireEntity(
        store.projects.find((project) => project.id === input.projectId),
        "Выбранный проект не найден."
      )

      const session = createSessionRecord(input)
      store.sessions.push(session)

      return session
    })
  )
}

export async function getSessionBundle(sessionId) {
  const store = await readStore()
  const session = requireEntity(
    store.sessions.find((item) => item.id === sessionId),
    "Сессия не найдена."
  )
  const project = requireEntity(
    store.projects.find((item) => item.id === session.projectId),
    "Проект сессии не найден."
  )
  const defects = sortByCreatedAt(
    store.defects.filter((item) => item.sessionId === session.id)
  )
  const reports = sortByCreatedAt(
    store.reports.filter((item) => item.sessionId === session.id)
  )

  return clone({
    project,
    session,
    defects,
    reports
  })
}

export async function createDefect(input) {
  if (!input.imageDataUrl) {
    throw new AppError(400, "Нужно приложить хотя бы одну фотографию дефекта.")
  }

  return clone(
    await withMutableStore(async (store) => {
      requireEntity(
        store.sessions.find((session) => session.id === input.sessionId),
        "Сессия для дефекта не найдена."
      )

      const photo = await savePhoto(input.imageDataUrl)
      const defect = createDefectRecord(
        input,
        photo
      )

      store.defects.push(defect)
      return defect
    })
  )
}

export async function updateDefect(defectId, input) {
  return clone(
    await withMutableStore(async (store) => {
      const defectIndex = store.defects.findIndex((item) => item.id === defectId)

      if (defectIndex === -1) {
        throw new AppError(404, "Дефект не найден.")
      }

      const defect = store.defects[defectIndex]
      const updated = updateDefectRecord(defect, input)
      store.defects[defectIndex] = updated
      return updated
    })
  )
}

export async function deleteDefect(defectId) {
  return clone(
    await withMutableStore(async (store) => {
      const defectIndex = store.defects.findIndex((item) => item.id === defectId)

      if (defectIndex === -1) {
        throw new AppError(404, "Дефект не найден.")
      }

      const [deletedDefect] = store.defects.splice(defectIndex, 1)
      return {
        id: deletedDefect.id
      }
    })
  )
}

export async function reanalyseDefect(defectId, input = {}) {
  return clone(
    await withMutableStore(async (store) => {
      const defectIndex = store.defects.findIndex((item) => item.id === defectId)

      if (defectIndex === -1) {
        throw new AppError(404, "Дефект не найден.")
      }

      const defect = store.defects[defectIndex]
      const photo = defect.photos[0]

      if (!photo) {
        throw new AppError(400, "У дефекта нет сохранённой фотографии для переанализа.")
      }

      const body = await fs.readFile(path.join(paths.uploadsDir, photo.fileName))
      const imageDataUrl = toImageDataUrl(photo, body)
      const suggestion = await suggestDefectFromImage(imageDataUrl, new Date().toISOString(), {
        modelKey: input.modelKey
      })

      const updated = {
        ...defect,
        aiSuggestion: finalizeAiSuggestion(
          suggestion,
          defect.defectType,
          new Date().toISOString()
        ),
        updatedAt: new Date().toISOString()
      }

      store.defects[defectIndex] = updated
      return updated
    })
  )
}

export async function createReport(sessionId, options = {}) {
  return clone(
    await withMutableStore(async (store) => {
      const session = requireEntity(
        store.sessions.find((item) => item.id === sessionId),
        "Сессия не найдена."
      )
      const project = requireEntity(
        store.projects.find((item) => item.id === session.projectId),
        "Проект сессии не найден."
      )
      const defects = sortByCreatedAt(
        store.defects.filter((item) => item.sessionId === session.id)
      )

      if (defects.length === 0) {
        throw new AppError(
          400,
          "Нельзя сформировать акт без зафиксированных дефектов."
        )
      }

      const version =
        store.reports.filter((report) => report.sessionId === sessionId).length + 1
      const snapshot = buildReportSnapshot({
        project,
        session,
        defects,
        reportLocale: options.reportLocale
      })
      const fileName = `${sessionId}-v${version}.html`
      const report = createReportRecord(
        {
          sessionId,
          snapshot,
          reportLocale: snapshot.reportLocale,
          generatedDocument: {
            fileName,
            publicPath: ""
          }
        },
        version
      )
      const html = renderReportHtml(snapshot)

      await fs.writeFile(path.join(paths.reportsDir, fileName), html, "utf8")
      report.generatedDocument.publicPath = `/api/reports/${encodeURIComponent(report.id)}/document`

      store.reports.push(report)
      return report
    })
  )
}

export async function getMediaAsset(assetId) {
  const store = await readStore()
  const photo = findPhotoById(store, assetId)
  const fileName = await resolvePhotoFileName(photo, assetId)

  if (!fileName) {
    throw new AppError(404, "Изображение дефекта не найдено.")
  }

  const body = await fs.readFile(path.join(paths.uploadsDir, fileName))

  return {
    body,
    contentType: photo?.mimeType || getMimeTypeFromFileName(fileName)
  }
}

export async function getReportDocument(reportId) {
  const store = await readStore()
  const report = requireEntity(
    store.reports.find((item) => item.id === reportId),
    "Сформированный акт не найден."
  )
  const body = await fs.readFile(
    path.join(paths.reportsDir, report.generatedDocument.fileName),
    "utf8"
  )

  return {
    body,
    contentType: "text/html; charset=utf-8"
  }
}
