import { randomUUID } from "node:crypto"

import { put } from "@vercel/blob"
import postgres from "postgres"

import { AppError } from "./app-error.js"
import {
  createDefectRecord,
  createProjectRecord,
  createReportRecord,
  createSessionRecord,
  updateDefectRecord
} from "./domain.js"
import { parseImageDataUrl } from "./image-data.js"
import { finalizeAiSuggestion, suggestDefectFromImage } from "./inference.js"
import { buildReportSnapshot, renderReportHtml } from "./report.js"
import { getBlobToken, getDatabaseUrl, isBlobEnabled } from "./runtime-config.js"

let schemaPromise = null

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function requireDatabaseUrl() {
  const connectionString = getDatabaseUrl()

  if (!connectionString) {
    throw new AppError(
      500,
      "Postgres backend выбран, но DATABASE_URL / POSTGRES_URL не настроен."
    )
  }

  return connectionString
}

function getSql() {
  if (!globalThis.__constructAiInspectorSql) {
    globalThis.__constructAiInspectorSql = postgres(requireDatabaseUrl(), {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 15
    })
  }

  return globalThis.__constructAiInspectorSql
}

async function ensureSchema() {
  if (!schemaPromise) {
    const sql = getSql()
    schemaPromise = sql.begin(async (tx) => {
      await tx`
        create table if not exists projects (
          id text primary key,
          name text not null,
          address text not null,
          description text not null,
          created_at text not null,
          updated_at text not null
        )
      `
      await tx`
        create table if not exists sessions (
          id text primary key,
          project_id text not null references projects(id) on delete cascade,
          inspector_name text not null,
          session_note text not null,
          created_at text not null,
          updated_at text not null
        )
      `
      await tx`
        create table if not exists defects (
          id text primary key,
          session_id text not null references sessions(id) on delete cascade,
          defect_type text not null,
          comment text not null,
          location_description text not null,
          photos_text text not null,
          ai_suggestion_text text,
          engineering_evaluation_text text,
          created_at text not null,
          updated_at text not null
        )
      `
      await tx`
        create table if not exists reports (
          id text primary key,
          session_id text not null references sessions(id) on delete cascade,
          version integer not null,
          status text not null,
          generated_document_text text not null,
          snapshot_text text not null,
          document_html text,
          created_at text not null,
          updated_at text not null,
          unique (session_id, version)
        )
      `
      await tx`
        create table if not exists media_assets (
          id text primary key,
          file_name text not null,
          mime_type text not null,
          payload_base64 text not null,
          created_at text not null
        )
      `
      await tx`
        create index if not exists idx_sessions_project_created_at
        on sessions (project_id, created_at)
      `
      await tx`
        create index if not exists idx_defects_session_created_at
        on defects (session_id, created_at)
      `
      await tx`
        create index if not exists idx_reports_session_created_at
        on reports (session_id, created_at)
      `
    })
  }

  await schemaPromise
}

function serializeJson(value, fallback = null) {
  return JSON.stringify(value ?? fallback)
}

function parseJson(value, fallback = null) {
  if (typeof value !== "string" || value === "") {
    return fallback
  }

  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapProjectRow(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapSessionRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    inspectorName: row.inspector_name,
    sessionNote: row.session_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapDefectRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    defectType: row.defect_type,
    comment: row.comment,
    locationDescription: row.location_description,
    photos: parseJson(row.photos_text, []),
    aiSuggestion: parseJson(row.ai_suggestion_text, null),
    engineeringEvaluation: parseJson(row.engineering_evaluation_text, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapReportRow(row) {
  return {
    id: row.id,
    sessionId: row.session_id,
    version: row.version,
    status: row.status,
    generatedDocument: parseJson(row.generated_document_text, null),
    snapshot: parseJson(row.snapshot_text, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function toImageDataUrl(photo, body) {
  return `data:${photo.mimeType};base64,${body.toString("base64")}`
}

async function storeBinaryAsset(assetId, fileName, mimeType, buffer) {
  const now = new Date().toISOString()

  if (isBlobEnabled()) {
    const blob = await put(`constructai/${assetId}-${fileName}`, buffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: mimeType,
      token: getBlobToken()
    })

    return {
      id: assetId,
      fileName,
      mimeType,
      publicPath: blob.url,
      createdAt: now
    }
  }

  const sql = getSql()
  await ensureSchema()
  await sql`
    insert into media_assets (
      id,
      file_name,
      mime_type,
      payload_base64,
      created_at
    )
    values (
      ${assetId},
      ${fileName},
      ${mimeType},
      ${buffer.toString("base64")},
      ${now}
    )
  `

  return {
    id: assetId,
    fileName,
    mimeType,
    publicPath: `/api/media/${encodeURIComponent(assetId)}`,
    createdAt: now
  }
}

async function storeReportDocument(reportId, fileName, html) {
  if (isBlobEnabled()) {
    const blob = await put(`constructai/${reportId}-${fileName}`, html, {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/html; charset=utf-8",
      token: getBlobToken()
    })

    return {
      generatedDocument: {
        fileName,
        publicPath: blob.url
      },
      documentHtml: null
    }
  }

  return {
    generatedDocument: {
      fileName,
      publicPath: `/api/reports/${encodeURIComponent(reportId)}/document`
    },
    documentHtml: html
  }
}

export async function getBootstrapData() {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    select id, name, address, description, created_at, updated_at
    from projects
    order by created_at asc
  `

  return {
    projects: rows.map(mapProjectRow)
  }
}

export async function createProject(input) {
  await ensureSchema()
  const sql = getSql()
  const now = new Date().toISOString()
  const project = createProjectRecord(input, now)

  await sql`
    insert into projects (
      id,
      name,
      address,
      description,
      created_at,
      updated_at
    )
    values (
      ${project.id},
      ${project.name},
      ${project.address},
      ${project.description},
      ${project.createdAt},
      ${project.updatedAt}
    )
  `

  return clone(project)
}

export async function createSession(input) {
  await ensureSchema()
  const sql = getSql()
  const session = createSessionRecord(input)
  const projectRows = await sql`
    select id
    from projects
    where id = ${input.projectId}
    limit 1
  `

  if (projectRows.length === 0) {
    throw new AppError(404, "Выбранный проект не найден.")
  }

  await sql`
    insert into sessions (
      id,
      project_id,
      inspector_name,
      session_note,
      created_at,
      updated_at
    )
    values (
      ${session.id},
      ${session.projectId},
      ${session.inspectorName},
      ${session.sessionNote},
      ${session.createdAt},
      ${session.updatedAt}
    )
  `

  return clone(session)
}

export async function getSessionBundle(sessionId) {
  await ensureSchema()
  const sql = getSql()
  const sessionRows = await sql`
    select id, project_id, inspector_name, session_note, created_at, updated_at
    from sessions
    where id = ${sessionId}
    limit 1
  `

  if (sessionRows.length === 0) {
    throw new AppError(404, "Сессия не найдена.")
  }

  const session = mapSessionRow(sessionRows[0])
  const projectRows = await sql`
    select id, name, address, description, created_at, updated_at
    from projects
    where id = ${session.projectId}
    limit 1
  `

  if (projectRows.length === 0) {
    throw new AppError(404, "Проект сессии не найден.")
  }

  const defectRows = await sql`
    select
      id,
      session_id,
      defect_type,
      comment,
      location_description,
      photos_text,
      ai_suggestion_text,
      engineering_evaluation_text,
      created_at,
      updated_at
    from defects
    where session_id = ${sessionId}
    order by created_at asc
  `
  const reportRows = await sql`
    select
      id,
      session_id,
      version,
      status,
      generated_document_text,
      snapshot_text,
      created_at,
      updated_at
    from reports
    where session_id = ${sessionId}
    order by created_at asc
  `

  return clone({
    project: mapProjectRow(projectRows[0]),
    session,
    defects: defectRows.map(mapDefectRow),
    reports: reportRows.map(mapReportRow)
  })
}

export async function createDefect(input) {
  if (!input.imageDataUrl) {
    throw new AppError(400, "Нужно приложить хотя бы одну фотографию дефекта.")
  }

  await ensureSchema()
  const sql = getSql()
  const sessionRows = await sql`
    select id
    from sessions
    where id = ${input.sessionId}
    limit 1
  `

  if (sessionRows.length === 0) {
    throw new AppError(404, "Сессия для дефекта не найдена.")
  }

  const parsed = parseImageDataUrl(input.imageDataUrl)
  const photoId = randomUUID()
  const photo = await storeBinaryAsset(
    photoId,
    `${photoId}.${parsed.extension}`,
    parsed.mimeType,
    parsed.buffer
  )
  const defect = createDefectRecord(
    {
      ...input,
      aiSuggestion: finalizeAiSuggestion(input.aiSuggestion, input.defectType)
    },
    photo
  )

  await sql`
    insert into defects (
      id,
      session_id,
      defect_type,
      comment,
      location_description,
      photos_text,
      ai_suggestion_text,
      engineering_evaluation_text,
      created_at,
      updated_at
    )
    values (
      ${defect.id},
      ${defect.sessionId},
      ${defect.defectType},
      ${defect.comment},
      ${defect.locationDescription},
      ${serializeJson(defect.photos, [])},
      ${serializeJson(defect.aiSuggestion, null)},
      ${serializeJson(defect.engineeringEvaluation, null)},
      ${defect.createdAt},
      ${defect.updatedAt}
    )
  `

  return clone(defect)
}

export async function updateDefect(defectId, input) {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    select
      id,
      session_id,
      defect_type,
      comment,
      location_description,
      photos_text,
      ai_suggestion_text,
      engineering_evaluation_text,
      created_at,
      updated_at
    from defects
    where id = ${defectId}
    limit 1
  `

  if (rows.length === 0) {
    throw new AppError(404, "Дефект не найден.")
  }

  const updatedDefect = updateDefectRecord(mapDefectRow(rows[0]), input)

  await sql`
    update defects
    set
      defect_type = ${updatedDefect.defectType},
      comment = ${updatedDefect.comment},
      location_description = ${updatedDefect.locationDescription},
      updated_at = ${updatedDefect.updatedAt}
    where id = ${defectId}
  `

  return clone(updatedDefect)
}

export async function deleteDefect(defectId) {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    delete from defects
    where id = ${defectId}
    returning id
  `

  if (rows.length === 0) {
    throw new AppError(404, "Дефект не найден.")
  }

  return {
    id: rows[0].id
  }
}

export async function reanalyseDefect(defectId, input = {}) {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    select
      id,
      session_id,
      defect_type,
      comment,
      location_description,
      photos_text,
      ai_suggestion_text,
      engineering_evaluation_text,
      created_at,
      updated_at
    from defects
    where id = ${defectId}
    limit 1
  `

  if (rows.length === 0) {
    throw new AppError(404, "Дефект не найден.")
  }

  const defect = mapDefectRow(rows[0])
  const photo = defect.photos[0]

  if (!photo) {
    throw new AppError(400, "У дефекта нет сохранённой фотографии для переанализа.")
  }

  let body = null

  if (photo.publicPath?.startsWith("/api/media/")) {
    const mediaRows = await sql`
      select payload_base64
      from media_assets
      where id = ${photo.id}
      limit 1
    `

    if (mediaRows.length === 0) {
      throw new AppError(404, "Не найдено изображение дефекта для переанализа.")
    }

    body = Buffer.from(mediaRows[0].payload_base64, "base64")
  } else {
    throw new AppError(
      400,
      "Переанализ для внешнего blob-хранилища пока не поддержан в этом backend-режиме."
    )
  }

  const now = new Date().toISOString()
  const suggestion = await suggestDefectFromImage(toImageDataUrl(photo, body), now, {
    modelKey: input.modelKey
  })
  const updatedDefect = {
    ...defect,
    aiSuggestion: finalizeAiSuggestion(suggestion, defect.defectType, now),
    updatedAt: now
  }

  await sql`
    update defects
    set
      ai_suggestion_text = ${serializeJson(updatedDefect.aiSuggestion, null)},
      updated_at = ${updatedDefect.updatedAt}
    where id = ${defectId}
  `

  return clone(updatedDefect)
}

export async function createReport(sessionId, options = {}) {
  await ensureSchema()
  const sql = getSql()

  return clone(
    await sql.begin(async (tx) => {
      const sessionRows = await tx`
        select id, project_id, inspector_name, session_note, created_at, updated_at
        from sessions
        where id = ${sessionId}
        for update
      `

      if (sessionRows.length === 0) {
        throw new AppError(404, "Сессия не найдена.")
      }

      const session = mapSessionRow(sessionRows[0])
      const projectRows = await tx`
        select id, name, address, description, created_at, updated_at
        from projects
        where id = ${session.projectId}
        limit 1
      `

      if (projectRows.length === 0) {
        throw new AppError(404, "Проект сессии не найден.")
      }

      const defectRows = await tx`
        select
          id,
          session_id,
          defect_type,
          comment,
          location_description,
          photos_text,
          ai_suggestion_text,
          engineering_evaluation_text,
          created_at,
          updated_at
        from defects
        where session_id = ${sessionId}
        order by created_at asc
      `

      if (defectRows.length === 0) {
        throw new AppError(
          400,
          "Нельзя сформировать акт без зафиксированных дефектов."
        )
      }

      const versionRows = await tx`
        select coalesce(max(version), 0) as max_version
        from reports
        where session_id = ${sessionId}
      `
      const version = Number(versionRows[0]?.max_version ?? 0) + 1
      const project = mapProjectRow(projectRows[0])
      const defects = defectRows.map(mapDefectRow)
      const snapshot = buildReportSnapshot({
        project,
        session,
        defects,
        reportLocale: options.reportLocale
      })
      const fileName = `${sessionId}-v${version}.html`
      const provisionalReport = createReportRecord(
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
      const storedDocument = await storeReportDocument(
        provisionalReport.id,
        fileName,
        html
      )

      provisionalReport.generatedDocument = storedDocument.generatedDocument

      await tx`
        insert into reports (
          id,
          session_id,
          version,
          status,
          generated_document_text,
          snapshot_text,
          document_html,
          created_at,
          updated_at
        )
        values (
          ${provisionalReport.id},
          ${provisionalReport.sessionId},
          ${provisionalReport.version},
          ${provisionalReport.status},
          ${serializeJson(provisionalReport.generatedDocument, null)},
          ${serializeJson(provisionalReport.snapshot, null)},
          ${storedDocument.documentHtml},
          ${provisionalReport.createdAt},
          ${provisionalReport.updatedAt}
        )
      `

      return provisionalReport
    })
  )
}

export async function getMediaAsset(assetId) {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    select file_name, mime_type, payload_base64
    from media_assets
    where id = ${assetId}
    limit 1
  `

  if (rows.length === 0) {
    throw new AppError(404, "Изображение дефекта не найдено.")
  }

  const asset = rows[0]

  return {
    body: Buffer.from(asset.payload_base64, "base64"),
    contentType: asset.mime_type,
    fileName: asset.file_name
  }
}

export async function getReportDocument(reportId) {
  await ensureSchema()
  const sql = getSql()
  const rows = await sql`
    select generated_document_text, document_html
    from reports
    where id = ${reportId}
    limit 1
  `

  if (rows.length === 0) {
    throw new AppError(404, "Сформированный акт не найден.")
  }

  const report = rows[0]
  const generatedDocument = parseJson(report.generated_document_text, null)

  if (typeof report.document_html === "string" && report.document_html !== "") {
    return {
      body: report.document_html,
      contentType: "text/html; charset=utf-8"
    }
  }

  if (generatedDocument?.publicPath) {
    return {
      redirectUrl: generatedDocument.publicPath
    }
  }

  throw new AppError(404, "HTML-документ акта недоступен.")
}
