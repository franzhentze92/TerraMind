/**
 * News API (Bloque N1 / N1.5-A).
 *
 *   GET  /api/news/sources
 *   GET  /api/news/documents
 *   GET  /api/news/documents/:id
 *   GET  /api/news/summary
 *   GET  /api/news/ingestion-runs
 *   POST /api/news/sources/:code/inspect
 *   POST /api/news/sources/:code/ingest
 *   POST /api/news/sources/:code/reprocess
 *   (compat) POST /api/news/sources/prensa-libre/{inspect|ingest|reprocess}
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { runOperationalGuard } from '../middleware/operational-guard.js'
import { rejectInvalidUuid } from '../http/route-utils.js'
import { jsonError, jsonResponse } from '../http/json.js'
import { readJsonBody } from '../http/body.js'
import {
  getNewsDocumentDetailDto,
  getNewsSummaryDto,
  ingestNewsSourceByCode,
  inspectNewsSourceByCode,
  listNewsDocumentsDto,
  listNewsIngestionRunsDto,
  listNewsSourcesDto,
  reprocessNewsSourceByCode,
} from '../services/news.service.js'
import {
  analyzeNewsDocumentDto,
  batchAnalyzeDto,
  getAnalysisDetailDto,
  getDocumentAnalysisDto,
  listAnalysesDto,
  listReviewQueueDto,
  rejectAnalysisDto,
  reviewAnalysisDto,
} from '../services/news-analysis.service.js'
import type { NewsModelTier } from '@/modules/news/providers/news-llm-config.js'

const LEGACY_SOURCE_ALIASES: Record<string, string> = {
  'prensa-libre': 'prensa_libre_gt',
  prensa_libre_gt: 'prensa_libre_gt',
  'emisoras-unidas': 'emisoras_unidas_gt',
  emisoras_unidas_gt: 'emisoras_unidas_gt',
}

function resolveSourceCodeParam(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (LEGACY_SOURCE_ALIASES[trimmed]) return LEGACY_SOURCE_ALIASES[trimmed]
  if (/^[a-z][a-z0-9_]{2,64}$/.test(trimmed)) return trimmed
  return null
}

export async function handleNewsRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  if (!pathname.startsWith('/api/news')) return false

  try {
    const sourceActionMatch = pathname.match(
      /^\/api\/news\/sources\/([^/]+)\/(inspect|ingest|reprocess)$/,
    )
    if (sourceActionMatch) {
      const code = resolveSourceCodeParam(sourceActionMatch[1]!)
      const action = sourceActionMatch[2]!
      if (!code) {
        jsonError(req, res, 'Código de fuente inválido', 400)
        return true
      }
      if (req.method !== 'POST') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }

      if (action === 'inspect') {
        const result = await runOperationalGuard(
          req,
          res,
          { permission: 'news.manage_sources', rateLimit: 'validation' },
          async (auth) => inspectNewsSourceByCode(auth, code),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      if (action === 'reprocess') {
        const result = await runOperationalGuard(
          req,
          res,
          {
            permission: 'news.manage_sources',
            rateLimit: 'reevaluation',
            auditType: `news_reprocess_${code}`,
          },
          async (auth) => reprocessNewsSourceByCode(auth, code),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      const result = await runOperationalGuard(
        req,
        res,
        {
          permission: 'news.run_ingestion',
          rateLimit: 'reevaluation',
          auditType: `news_ingest_${code}`,
        },
        async (auth) => ingestNewsSourceByCode(auth, code),
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

    const docAnalysisMatch = pathname.match(/^\/api\/news\/documents\/([^/]+)\/analysis$/)
    if (docAnalysisMatch) {
      const documentId = docAnalysisMatch[1]!
      if (rejectInvalidUuid(req, res, documentId, 'ID de documento')) return true

      if (req.method === 'GET') {
        const result = await runOperationalGuard(
          req,
          res,
          { permission: 'news.analysis.view', rateLimit: 'default_read' },
          async () => ({ analysis: await getDocumentAnalysisDto(documentId) }),
        )
        if (result === null) return true
        jsonResponse(req, res, result.analysis)
        return true
      }

      if (req.method === 'POST') {
        const body = await readJsonBody<{ modelTier?: NewsModelTier }>(req).catch(() => ({}))
        const result = await runOperationalGuard(
          req,
          res,
          { permission: 'news.analysis.run', rateLimit: 'reevaluation', auditType: 'news_analyze_document' },
          async (auth) => analyzeNewsDocumentDto(auth, documentId, body.modelTier ?? 'fast'),
        )
        if (result === null) return true
        jsonResponse(req, res, result)
        return true
      }

      jsonError(req, res, 'Method not allowed', 405)
      return true
    }

    const analyzeDocMatch = pathname.match(/^\/api\/news\/documents\/([^/]+)\/analyze$/)
    if (analyzeDocMatch) {
      if (req.method !== 'POST') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const documentId = analyzeDocMatch[1]!
      if (rejectInvalidUuid(req, res, documentId, 'ID de documento')) return true
      const body = await readJsonBody<{ modelTier?: NewsModelTier }>(req).catch(() => ({}))
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.analysis.run', rateLimit: 'reevaluation', auditType: 'news_analyze_document' },
        async (auth) => analyzeNewsDocumentDto(auth, documentId, body.modelTier ?? 'fast'),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    if (pathname === '/api/news/analyses') {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const requiresReview = searchParams.get('requires_review') === 'true'
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.analysis.view', rateLimit: 'default_read' },
        async () =>
          requiresReview
            ? listReviewQueueDto()
            : listAnalysesDto({
                requiresReview: requiresReview || undefined,
                limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
              }),
      )
      if (result === null) return true
      jsonResponse(req, res, { items: result })
      return true
    }

    if (pathname === '/api/news/analyses/batch') {
      if (req.method !== 'POST') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const body = await readJsonBody<{
        documentIds?: string[]
        limit?: number
        dryRun?: boolean
        modelTier?: NewsModelTier
        estimatedCostConfirmation?: boolean
      }>(req).catch(() => ({}))
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.analysis.run', rateLimit: 'reevaluation', auditType: 'news_analyze_batch' },
        async (auth) => batchAnalyzeDto(auth, body),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    const analysisDetailMatch = pathname.match(/^\/api\/news\/analyses\/([^/]+)$/)
    if (analysisDetailMatch && !pathname.endsWith('/review') && !pathname.endsWith('/reject')) {
      if (req.method !== 'GET') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const id = analysisDetailMatch[1]!
      if (rejectInvalidUuid(req, res, id, 'ID de análisis')) return true
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.analysis.view', rateLimit: 'default_read' },
        async () => ({ analysis: await getAnalysisDetailDto(id) }),
      )
      if (result === null) return true
      if (!result.analysis) {
        jsonError(req, res, 'Análisis no encontrado', 404)
        return true
      }
      jsonResponse(req, res, result.analysis)
      return true
    }

    const analysisReviewMatch = pathname.match(/^\/api\/news\/analyses\/([^/]+)\/review$/)
    if (analysisReviewMatch) {
      if (req.method !== 'POST') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const id = analysisReviewMatch[1]!
      if (rejectInvalidUuid(req, res, id, 'ID de análisis')) return true
      const body = await readJsonBody<{ notes?: string }>(req).catch(() => ({}))
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.analysis.review', rateLimit: 'validation', auditType: 'news_analysis_review' },
        async (auth) => reviewAnalysisDto(auth, id, 'approve', body.notes),
      )
      if (result === null) return true
      jsonResponse(req, res, result)
      return true
    }

    const analysisRejectMatch = pathname.match(/^\/api\/news\/analyses\/([^/]+)\/reject$/)
    if (analysisRejectMatch) {
      if (req.method !== 'POST') {
        jsonError(req, res, 'Method not allowed', 405)
        return true
      }
      const id = analysisRejectMatch[1]!
      if (rejectInvalidUuid(req, res, id, 'ID de análisis')) return true
      const body = await readJsonBody<{ reason?: string }>(req).catch(() => ({}))
      const result = await runOperationalGuard(
        req,
        res,
        { permission: 'news.analysis.review', rateLimit: 'validation', auditType: 'news_analysis_reject' },
        async (auth) => rejectAnalysisDto(auth, id, body.reason),
      )
      if (result === null) return true
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
