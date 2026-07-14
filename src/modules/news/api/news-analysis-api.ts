import { authFetch } from '@/core/auth/auth-fetch'
import type {
  NewsAnalysisBatchDryRunDto,
  NewsAnalysisBatchResultDto,
  NewsAnalysisReviewQueueItemDto,
  NewsDocumentAnalysisDto,
} from '../types/news-analysis-dto.types'

export async function fetchDocumentAnalysis(documentId: string): Promise<NewsDocumentAnalysisDto | null> {
  const res = await authFetch(`/api/news/documents/${documentId}/analysis`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('No se pudo cargar el análisis')
  return res.json() as Promise<NewsDocumentAnalysisDto>
}

export async function analyzeNewsDocument(
  documentId: string,
  modelTier: 'fast' | 'deep' = 'fast',
): Promise<NewsDocumentAnalysisDto> {
  const res = await authFetch(`/api/news/documents/${documentId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelTier }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Error al analizar la noticia')
  }
  return res.json() as Promise<NewsDocumentAnalysisDto>
}

export async function fetchAnalysisDetail(analysisId: string): Promise<NewsDocumentAnalysisDto> {
  const res = await authFetch(`/api/news/analyses/${analysisId}`)
  if (!res.ok) throw new Error('No se pudo cargar el análisis')
  return res.json() as Promise<NewsDocumentAnalysisDto>
}

export async function fetchReviewQueue(): Promise<NewsAnalysisReviewQueueItemDto[]> {
  const res = await authFetch('/api/news/analyses?requires_review=true')
  if (!res.ok) throw new Error('No se pudo cargar la cola de revisión')
  const data = (await res.json()) as { items: NewsAnalysisReviewQueueItemDto[] }
  return data.items
}

export async function batchAnalyzeDryRun(input: {
  documentIds?: string[]
  limit?: number
  modelTier?: 'fast' | 'deep'
}): Promise<NewsAnalysisBatchDryRunDto> {
  const res = await authFetch('/api/news/analyses/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, dryRun: true }),
  })
  if (!res.ok) throw new Error('No se pudo estimar el lote')
  return res.json() as Promise<NewsAnalysisBatchDryRunDto>
}

export async function batchAnalyze(input: {
  documentIds?: string[]
  limit?: number
  modelTier?: 'fast' | 'deep'
  estimatedCostConfirmation: boolean
}): Promise<NewsAnalysisBatchResultDto> {
  const res = await authFetch('/api/news/analyses/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, dryRun: false }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Error al ejecutar el lote')
  }
  return res.json() as Promise<NewsAnalysisBatchResultDto>
}

export async function approveAnalysis(analysisId: string, notes?: string): Promise<NewsDocumentAnalysisDto> {
  const res = await authFetch(`/api/news/analyses/${analysisId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  })
  if (!res.ok) throw new Error('No se pudo aprobar el análisis')
  return res.json() as Promise<NewsDocumentAnalysisDto>
}

export async function rejectAnalysis(analysisId: string, reason?: string): Promise<NewsDocumentAnalysisDto> {
  const res = await authFetch(`/api/news/analyses/${analysisId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  })
  if (!res.ok) throw new Error('No se pudo rechazar el análisis')
  return res.json() as Promise<NewsDocumentAnalysisDto>
}
