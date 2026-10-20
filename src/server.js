import { createServer } from "node:http"
import { promises as fs } from "node:fs"
import path from "node:path"

import { AppError } from "./app-error.js"
import { handleApiRequest } from "./api-handler.js"
import { paths } from "./paths.js"
import { isPublicPreview } from "./runtime-config.js"

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST || "127.0.0.1"

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  })
  response.end(JSON.stringify(payload))
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase()

  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8"
    case ".css":
      return "text/css; charset=utf-8"
    case ".js":
      return "text/javascript; charset=utf-8"
    case ".json":
      return "application/json; charset=utf-8"
    case ".jpg":
    case ".jpeg":
      return "image/jpeg"
    case ".png":
      return "image/png"
    case ".svg":
      return "image/svg+xml"
    case ".webp":
      return "image/webp"
    case ".heic":
      return "image/heic"
    case ".heif":
      return "image/heif"
    default:
      return "application/octet-stream"
  }
}

function resolveStaticPath(baseDir, requestPath) {
  const trimmed = decodeURIComponent(requestPath.replace(/^\/+/, ""))
  const filePath = path.resolve(baseDir, trimmed)
  const safePrefix = `${baseDir}${path.sep}`

  if (filePath !== baseDir && !filePath.startsWith(safePrefix)) {
    throw new AppError(403, "Запрошен недопустимый путь.")
  }

  return filePath
}

async function serveFile(response, filePath) {
  const file = await fs.readFile(filePath)
  response.writeHead(200, {
    "content-type": getContentType(filePath)
  })
  response.end(file)
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`)
    const { pathname } = url

    if (pathname.startsWith("/api/")) {
      await handleApiRequest(request, response, pathname)
      return
    }

    if (request.method !== "GET") {
      throw new AppError(405, "Метод не поддерживается.")
    }

    if (pathname.startsWith("/uploads/")) {
      if (isPublicPreview()) throw new AppError(403, "Workspace media is private.")
      const filePath = resolveStaticPath(
        paths.uploadsDir,
        pathname.slice("/uploads/".length)
      )
      await serveFile(response, filePath)
      return
    }

    if (pathname.startsWith("/reports/")) {
      if (isPublicPreview()) throw new AppError(403, "Workspace reports are private.")
      const filePath = resolveStaticPath(
        paths.reportsDir,
        pathname.slice("/reports/".length)
      )
      await serveFile(response, filePath)
      return
    }

    const publicPath = pathname === "/try" || (pathname === "/" && isPublicPreview())
      ? "try.html" : pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "")
    const filePath = resolveStaticPath(paths.publicDir, publicPath)
    await serveFile(response, filePath)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      sendJson(response, 404, { error: "Ресурс не найден." })
      return
    }

    const statusCode =
      error instanceof AppError && Number.isInteger(error.statusCode)
        ? error.statusCode
        : 500
    const message =
      error instanceof Error ? error.message : "Внутренняя ошибка сервера."
    sendJson(response, statusCode, { error: message })
  }
})

server.listen(port, host, () => {
  console.log(`ConstructAI Inspector is running on http://${host}:${server.address().port}`)
})
