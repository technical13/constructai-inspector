import { AppError } from "./app-error.js"

export function parseImageDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i.exec(
    dataUrl ?? ""
  )

  if (!match) {
    throw new AppError(400, "Ожидается изображение в формате data URL.")
  }

  const [, mimeType, encoded] = match
  const extByMime = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif"
  }
  const normalizedMimeType = mimeType.toLowerCase()
  const extension = extByMime[normalizedMimeType]

  if (!extension) {
    throw new AppError(415, "Формат изображения не поддерживается.")
  }

  const buffer = Buffer.from(encoded.replaceAll(/\s+/g, ""), "base64")

  if (buffer.length === 0) {
    throw new AppError(400, "Изображение не содержит данных.")
  }

  return {
    mimeType: normalizedMimeType,
    extension,
    buffer
  }
}
