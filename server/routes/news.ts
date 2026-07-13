/**
 * News API (Bloque N1).
 *
 *   GET  /api/news/sources
 *   GET  /api/news/documents
 *   GET  /api/news/documents/:id
 *   GET  /api/news/summary
 *   GET  /api/news/ingestion-runs
 *   POST /api/news/sources/prensa-libre/inspect
 *   POST /api/news/sources/prensa-libre/ingest
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import {
  getNewsDocumentDetailDto,
  getNewsSummaryDto,
  ingestPrensaLibre,
  inspectPrensaLibreSource,
  listNewsDocumentsDto,
  listNewsIngestionRunsDto,
  listNewsSourcesDto,
  reprocessPrensaLibre,
} from '../services/news.service.js'

export async function handleNewsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/news')) return false

  try {
    if (pathname === '/api/news/sources/prensa-libre/inspect') {
      if (req.method !== 'POST') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.manage_sources', rateLimit: 'validation' },
        async (auth) => inspectPrensaLibreSource(auth),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/news/sources/prensa-libre/reprocess') {
      if (req.method !== 'POST') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.manage_sources', rateLimit: 'reevaluation', auditType: 'news_reprocess_prensa_libre' },
        async (auth) => reprocessPrensaLibre(auth),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/news/sources/prensa-libre/ingest') {
      if (req.method !== 'POST') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.run_ingestion', rateLimit: 'reevaluation', auditType: 'news_ingest_prensa_libre' },
        async (auth) => ingestPrensaLibre(auth),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/news/sources') {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.view', rateLimit: 'default_read' },
        async () => listNewsSourcesDto(),
      )
      if (result === null) return true
      jsonResponse(req, res, { items: result })
      return true
    }

    if (pathname === '/api/news/summary') {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const periodHours = Number(searchParams.get('period_hours') ?? 168)
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.view', rateLimit: 'default_read' },
        async () => getNewsSummaryDto(Number.isFinite(periodHours) ? periodHours : 168),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/news/ingestion-runs') {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const sourceId = searchParams.get('source_id') ?? undefined
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.manage_sources', rateLimit: 'default_read' },
        async () => listNewsIngestionRunsDto(sourceId),
      )
      if (result === null) return true
      jsonResponse(req, res, { items: result })
      return true
    }

    if (pathname === '/api/news/documents') {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.view', rateLimit: 'default_read' },
        async () =>
          listNewsDocumentsDto({
            source_id: searchParams.get('source_id') ?? undefined,
            category: searchParams.get('category') ?? undefined,
            department_code: searchParams.get('department_code') ?? undefined,
            geographic_status: searchParams.get('geographic_status') ?? undefined,
            processing_status: searchParams.get('processing_status') ?? undefined,
            published_from: searchParams.get('published_from') ?? undefined,
            published_to: searchParams.get('published_to') ?? undefined,
            search: searchParams.get('search') ?? undefined,
            limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
            cursor: searchParams.get('cursor') ?? undefined,
          }),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    const detailMatch = pathname.match(/^\/api\/news\/documents\/([^/]+)$/)
    if (detailMatch) {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const id = detailMatch[1]!
      if (rejectInvalidUuid(req, res, id, 'ID de documento')) return true
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.view', rateLimit: 'default_read' },
        async () => getNewsDocumentDetailDto(id),
      )
      if (result === null) return true
      if (!result) {
        jsonError(req, res, 'Documento no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result)
      return true
    }

    jsonError(req, res, 'Not found', 404)
    return true
  } catch (err) {
    jsonError(req, res, err instanceof Error ? err.message : 'Error interno', 500)
    return true
  }
}
