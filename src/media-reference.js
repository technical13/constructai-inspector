import path from "node:path"

const extensionByMimeType = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/heic", "heic"],
  ["image/heif", "heif"]
])

const mimeTypeByExtension = new Map(
  [...extensionByMimeType].map(([mimeType, extension]) => [extension, mimeType])
)

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function decodePathSegment(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function getPhotoAssetId(photo) {
  const explicitId = normalizeString(photo?.id)
  if (explicitId) {
    return explicitId
  }

  const publicPath = normalizeString(photo?.publicPath)
  const apiMatch = /^\/api\/media\/([^/?#]+)/.exec(publicPath)
  if (apiMatch) {
    return decodePathSegment(apiMatch[1])
  }

  const uploadMatch = /^\/uploads\/([^/?#]+)$/.exec(publicPath)
  return uploadMatch ? path.parse(decodePathSegment(uploadMatch[1])).name : ""
}

export function getPhotoFileName(photo, assetId = getPhotoAssetId(photo)) {
  const explicitFileName = normalizeString(photo?.fileName)
  if (explicitFileName) {
    return path.basename(explicitFileName)
  }

  const publicPath = normalizeString(photo?.publicPath)
  const uploadMatch = /^\/uploads\/([^/?#]+)$/.exec(publicPath)
  if (uploadMatch) {
    return path.basename(decodePathSegment(uploadMatch[1]))
  }

  const extension = extensionByMimeType.get(normalizeString(photo?.mimeType).toLowerCase())
  return assetId && extension ? `${assetId}.${extension}` : ""
}

export function getMimeTypeFromFileName(fileName) {
  const extension = path.extname(fileName).slice(1).toLowerCase()
  return mimeTypeByExtension.get(extension) || "application/octet-stream"
}
