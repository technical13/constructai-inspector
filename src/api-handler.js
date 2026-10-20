import { AppError } from "./app-error.js"
import { defectCatalog } from "./catalog.js"
import { deleteDemoScenario, saveDemoScenario } from "./demo-scenarios.js"
import {
  compareDefectSuggestions,
  getCvModels,
  suggestDefectFromImage
} from "./inference.js"
import {
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
  storageBackend,
  updateDefect
} from "./store.js"
import {
  getDefaultCvModelKey,
  isDemoLibraryWritable,
  isPublicPreview
} from "./runtime-config.js"
import { getInferencePolicy } from "./inference-gateway.js"
import { handlePublicPreview } from "./public-preview.js"

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  })
  response.end(JSON.stringify(payload))
}

function sendError(response, error) {
  const statusCode =
    error instanceof AppError && Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500
  const message =
    error instanceof Error ? error.message : "Внутренняя ошибка сервера."

  sendJson(response, statusCode, { error: message })
}

function sendBinary(response, statusCode, body, contentType) {
  response.writeHead(statusCode, {
    "content-type": contentType
  })
  response.end(body)
}

function redirect(response, location) {
  response.writeHead(302, {
    location
  })
  response.end()
}

function requireWritableDemoLibrary() {
  if (!isDemoLibraryWritable()) {
    throw new AppError(403, "Demo-библиотека доступна только для чтения.")
  }
}

async function readJsonBody(request, maxBytes = 20 * 1024 * 1024) {
  const chunks = []
  let total = 0

  for await (const chunk of request) {
    total += chunk.length
    if (total > maxBytes) {
      throw new AppError(413, "Размер запроса превышает допустимый лимит.")
    }
    chunks.push(chunk)
  }

  if (chunks.length === 0) {
    return {}
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw new AppError(400, "Тело запроса должно быть валидным JSON.")
  }
}

export async function handleApiRequest(request, response, pathname) {
  if (isPublicPreview() || pathname.startsWith("/api/preview/")) {
    return handlePublicPreview(request, response, pathname)
  }
  try {
    if (request.method === "GET" && pathname === "/api/bootstrap") {
      const bootstrap = await getBootstrapData()
      return sendJson(response, 200, {
        ...bootstrap,
        defectCatalog,
        cvModels: getCvModels(),
        defaultCvModelKey: getDefaultCvModelKey(),
        runtime: {
          storageBackend,
          demoLibraryWritable: isDemoLibraryWritable(),
          inferencePolicy: getInferencePolicy()
        }
      })
    }

    if (request.method === "POST" && pathname === "/api/projects") {
      const body = await readJsonBody(request)
      const project = await createProject(body)
      return sendJson(response, 201, { project })
    }

    if (request.method === "POST" && pathname === "/api/ai/suggest") {
      const body = await readJsonBody(request)
      const suggestion = await suggestDefectFromImage(
        body.imageDataUrl,
        new Date().toISOString(),
        {
          modelKey: body.modelKey
        }
      )
      return sendJson(response, 200, {
        suggestion,
        humanConfirmationRequired: true
      })
    }

    if (request.method === "POST" && pathname === "/api/ai/compare") {
      const body = await readJsonBody(request)
      const results = await compareDefectSuggestions(
        body.imageDataUrl,
        new Date().toISOString(),
        {
          modelKeys: body.modelKeys
        }
      )
      return sendJson(response, 200, { results })
    }

    if (request.method === "POST" && pathname === "/api/sessions") {
      const body = await readJsonBody(request)
      const session = await createSession(body)
      return sendJson(response, 201, { session })
    }

    if (request.method === "GET" && pathname.startsWith("/api/sessions/")) {
      const sessionId = pathname.split("/").at(-1)
      const bundle = await getSessionBundle(sessionId)
      return sendJson(response, 200, bundle)
    }

    if (request.method === "POST" && pathname === "/api/defects") {
      const body = await readJsonBody(request)
      const defect = await createDefect(body)
      return sendJson(response, 201, { defect })
    }

    if (request.method === "POST" && pathname === "/api/demo-scenarios") {
      requireWritableDemoLibrary()
      const body = await readJsonBody(request)
      const scenario = await saveDemoScenario(body)
      return sendJson(response, 201, { scenario })
    }

    const demoScenarioMatch = pathname.match(/^\/api\/demo-scenarios\/([^/]+)$/)
    if (request.method === "DELETE" && demoScenarioMatch) {
      requireWritableDemoLibrary()
      const deleted = await deleteDemoScenario(
        decodeURIComponent(demoScenarioMatch[1])
      )
      return sendJson(response, 200, { deleted })
    }

    const defectMatch = pathname.match(/^\/api\/defects\/([^/]+)$/)
    if (request.method === "PATCH" && defectMatch) {
      const body = await readJsonBody(request)
      const defect = await updateDefect(decodeURIComponent(defectMatch[1]), body)
      return sendJson(response, 200, { defect })
    }

    if (request.method === "DELETE" && defectMatch) {
      const deleted = await deleteDefect(decodeURIComponent(defectMatch[1]))
      return sendJson(response, 200, { deleted })
    }

    const reanalyseMatch = pathname.match(/^\/api\/defects\/([^/]+)\/reanalyse$/)
    if (request.method === "POST" && reanalyseMatch) {
      const body = await readJsonBody(request)
      const defect = await reanalyseDefect(decodeURIComponent(reanalyseMatch[1]), {
        modelKey: body.modelKey
      })
      return sendJson(response, 200, { defect })
    }

    if (request.method === "POST" && pathname === "/api/reports") {
      const body = await readJsonBody(request)
      const report = await createReport(body.sessionId, {
        reportLocale: body.reportLocale
      })
      return sendJson(response, 201, { report })
    }

    const mediaMatch =
      request.method === "GET" ? pathname.match(/^\/api\/media\/([^/]+)$/) : null
    if (mediaMatch) {
      const asset = await getMediaAsset(decodeURIComponent(mediaMatch[1]))
      return sendBinary(response, 200, asset.body, asset.contentType)
    }

    const reportMatch =
      request.method === "GET"
        ? pathname.match(/^\/api\/reports\/([^/]+)\/document$/)
        : null
    if (reportMatch) {
      const reportDocument = await getReportDocument(
        decodeURIComponent(reportMatch[1])
      )

      if (reportDocument.redirectUrl) {
        return redirect(response, reportDocument.redirectUrl)
      }

      return sendBinary(
        response,
        200,
        reportDocument.body,
        reportDocument.contentType
      )
    }

    throw new AppError(404, "API endpoint не найден.")
  } catch (error) {
    sendError(response, error)
  }
}
