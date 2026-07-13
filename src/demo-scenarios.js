import { randomUUID } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import { AppError } from "./app-error.js"
import { writeFileAtomic } from "./atomic-file.js"
import { finalizeAiSuggestion } from "./inference.js"
import { parseImageDataUrl } from "./image-data.js"
import { paths } from "./paths.js"

let mutationQueue = Promise.resolve()

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function slugify(value) {
  const normalized = normalizeOptionalString(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "demo"
}

function withDemoMutation(mutator) {
  const run = mutationQueue.then(mutator)
  mutationQueue = run.catch(() => {})
  return run
}

function getDemoPaths(publicDir = paths.publicDir) {
  const demoDir = path.join(publicDir, "demo")
  return {
    demoDir,
    imagesDir: path.join(demoDir, "images"),
    scenariosFile: path.join(demoDir, "scenarios.json")
  }
}

async function ensureDemoStorage(publicDir = paths.publicDir) {
  const demoPaths = getDemoPaths(publicDir)
  await fs.mkdir(demoPaths.demoDir, { recursive: true })
  await fs.mkdir(demoPaths.imagesDir, { recursive: true })

  try {
    await fs.access(demoPaths.scenariosFile)
  } catch {
    await writeFileAtomic(
      demoPaths.scenariosFile,
      `${JSON.stringify({ version: 1, generatedBy: "constructai-demo-library", scenarios: [] }, null, 2)}\n`,
      "utf8"
    )
  }

  return demoPaths
}

async function readScenarioDocument(publicDir = paths.publicDir) {
  const demoPaths = await ensureDemoStorage(publicDir)
  const raw = await fs.readFile(demoPaths.scenariosFile, "utf8")
  const parsed = JSON.parse(raw)

  return {
    demoPaths,
    document: {
      version: Number.isInteger(parsed.version) ? parsed.version : 1,
      generatedBy:
        typeof parsed.generatedBy === "string" && parsed.generatedBy.trim() !== ""
          ? parsed.generatedBy.trim()
          : "constructai-demo-library",
      scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : []
    }
  }
}

function getScenarioImagePath(demoPaths, imageUrl) {
  const normalizedUrl = normalizeOptionalString(imageUrl)

  if (!normalizedUrl.startsWith("/demo/images/")) {
    throw new AppError(400, "У demo-сценария некорректный путь к изображению.")
  }

  return path.join(demoPaths.imagesDir, path.basename(normalizedUrl))
}

function buildDefaultDescription(modelLabel, locale = "ru") {
  if (locale === "en") {
    return `Saved from local ${modelLabel} analysis.`
  }

  return `Сохранено из локального анализа ${modelLabel}.`
}

export async function saveDemoScenario(input, options = {}) {
  const imageDataUrl = normalizeOptionalString(input?.imageDataUrl)

  if (!imageDataUrl) {
    throw new AppError(400, "Нельзя сохранить demo без изображения.")
  }

  if (!input?.suggestion || typeof input.suggestion !== "object") {
    throw new AppError(400, "Нельзя сохранить demo без AI-результата.")
  }

  const locale = input?.locale === "en" ? "en" : "ru"
  const finalType = normalizeOptionalString(input?.finalType) || input.suggestion.finalType || input.suggestion.suggestedType || "other"
  const finalSuggestion = finalizeAiSuggestion(
    input.suggestion,
    finalType,
    new Date().toISOString()
  )

  if (!finalSuggestion?.visualEvidence) {
    throw new AppError(400, "Для demo нужен визуальный результат модели.")
  }

  const parsedImage = parseImageDataUrl(imageDataUrl)
  const title =
    normalizeOptionalString(input?.title) ||
    `${finalSuggestion.finalTypeLabel || finalSuggestion.suggestedTypeLabel || "Demo"}`
  const description =
    normalizeOptionalString(input?.description) ||
    buildDefaultDescription(finalSuggestion.modelLabel || "AI", locale)
  const scenarioId = `${slugify(title)}-${randomUUID().slice(0, 8)}`

  return withDemoMutation(async () => {
    const { demoPaths, document } = await readScenarioDocument(options.publicDir)
    const imageFileName = `${scenarioId}.${parsedImage.extension}`
    const imagePath = path.join(demoPaths.imagesDir, imageFileName)
    const scenario = {
      id: scenarioId,
      title,
      description,
      imageUrl: `/demo/images/${imageFileName}`,
      locationDescription: normalizeOptionalString(input?.locationDescription),
      comment: normalizeOptionalString(input?.comment),
      suggestion: finalSuggestion
    }

    await fs.writeFile(imagePath, parsedImage.buffer)
    document.scenarios.unshift(scenario)

    try {
      await writeFileAtomic(
        demoPaths.scenariosFile,
        `${JSON.stringify(document, null, 2)}\n`,
        "utf8"
      )
    } catch (error) {
      await fs.rm(imagePath, { force: true }).catch(() => {})
      throw error
    }

    return scenario
  })
}

export async function deleteDemoScenario(scenarioId, options = {}) {
  const normalizedId = normalizeOptionalString(scenarioId)

  if (!normalizedId) {
    throw new AppError(400, "Не указан demo-сценарий для удаления.")
  }

  return withDemoMutation(async () => {
    const { demoPaths, document } = await readScenarioDocument(options.publicDir)
    const index = document.scenarios.findIndex((item) => item?.id === normalizedId)

    if (index === -1) {
      throw new AppError(404, "Demo-сценарий не найден.")
    }

    const [removedScenario] = document.scenarios.splice(index, 1)
    const imagePath = getScenarioImagePath(demoPaths, removedScenario.imageUrl)
    const tombstonePath = `${imagePath}.${randomUUID()}.delete-tmp`
    let imageMoved = false

    try {
      await fs.rename(imagePath, tombstonePath)
      imageMoved = true
    } catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
        throw error
      }
    }

    try {
      await writeFileAtomic(
        demoPaths.scenariosFile,
        `${JSON.stringify(document, null, 2)}\n`,
        "utf8"
      )
    } catch (error) {
      if (imageMoved) {
        await fs.rename(tombstonePath, imagePath).catch(() => {})
      }
      throw error
    }

    if (imageMoved) {
      await fs.rm(tombstonePath, { force: true })
    }

    return {
      id: normalizedId,
      imageUrl: removedScenario.imageUrl
    }
  })
}
