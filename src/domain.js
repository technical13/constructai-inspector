import { randomUUID } from "node:crypto"

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Поле "${fieldName}" обязательно.`)
  }

  return value.trim()
}

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeLocale(value) {
  return value === "en" ? "en" : "ru"
}

function normalizeDefectType(value) {
  return requireNonEmptyString(value, "defectType")
}

function normalizeDefectComment(value) {
  return requireNonEmptyString(value, "comment")
}

export function createProjectRecord(input, now = new Date().toISOString()) {
  return {
    id: randomUUID(),
    name: requireNonEmptyString(input.name, "name"),
    address: normalizeOptionalString(input.address),
    description: normalizeOptionalString(input.description),
    createdAt: now,
    updatedAt: now
  }
}

export function createSessionRecord(input, now = new Date().toISOString()) {
  return {
    id: randomUUID(),
    projectId: requireNonEmptyString(input.projectId, "projectId"),
    inspectorName: normalizeOptionalString(input.inspectorName),
    sessionNote: normalizeOptionalString(input.sessionNote),
    createdAt: now,
    updatedAt: now
  }
}

export function createDefectRecord(input, photo, now = new Date().toISOString()) {
  return {
    id: randomUUID(),
    sessionId: requireNonEmptyString(input.sessionId, "sessionId"),
    defectType: normalizeDefectType(input.defectType),
    comment: normalizeDefectComment(input.comment),
    locationDescription: normalizeOptionalString(input.locationDescription),
    photos: [photo],
    aiSuggestion: input.aiSuggestion ?? null,
    engineeringEvaluation: null,
    createdAt: now,
    updatedAt: now
  }
}

export function updateDefectRecord(defect, input, now = new Date().toISOString()) {
  return {
    ...defect,
    defectType: normalizeDefectType(input.defectType),
    comment: normalizeDefectComment(input.comment),
    locationDescription: normalizeOptionalString(input.locationDescription),
    updatedAt: now
  }
}

export function createReportRecord(
  input,
  version,
  now = new Date().toISOString()
) {
  return {
    id: randomUUID(),
    sessionId: requireNonEmptyString(input.sessionId, "sessionId"),
    version,
    status: "draft",
    generatedDocument: input.generatedDocument,
    snapshot: input.snapshot,
    reportLocale: normalizeLocale(input.reportLocale),
    createdAt: now,
    updatedAt: now
  }
}
