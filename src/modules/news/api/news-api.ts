import { authFetch } from '@/core/auth/auth-fetch'
import type {
  NewsDocumentDetailDto,
  NewsDocumentListItemDto,
  NewsIngestionResultDto,
  NewsIngestionRunDto,
  NewsSourceDto,
  NewsSummaryDto,
} from '../types/news-dto.types'

export async function fetchNewsSources(): Promise<NewsSourceDto[]> {
  const res = await authFetch('/api/news/sources')
  if (!res.ok) throw new Error('No se pudieron cargar las fuentes')
  const data = (await res.json()) as { items: NewsSourceDto[] }
  return data.items
}

export async function fetchNewsSummary(periodHours = 168): Promise<NewsSummaryDto> {
  const res = await authFetch(`/api/news/summary?period_hours=${periodHours}`)
  if (!res.ok) throw new Error('No se pudo cargar el resumen de noticias')
  return res.json() as Promise<NewsSummaryDto>
}

export async function fetchNewsDocuments(filters: Record<string, string | number | undefined> = {}): Promise<{
  items: NewsDocumentListItemDto[]
  next_cursor: string | null
}> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const res = await authFetch(`/api/news/documents?${params.toString()}`)
  if (!res.ok) throw new Error('No se pudieron cargar las noticias')
  return res.json() as Promise<{ items: NewsDocumentListItemDto[]; next_cursor: string | null }>
}

export async function fetchNewsDocumentDetail(id: string): Promise<NewsDocumentDetailDto> {
  const res = await authFetch(`/api/news/documents/${id}`)
  if (!res.ok) throw new Error('No se pudo cargar el documento')
  return res.json() as Promise<NewsDocumentDetailDto>
}

/** @deprecated Preferir runNewsSourceIngestion(code) */
export async function runPrensaLibreIngestion(): Promise<NewsIngestionResultDto> {
  return runNewsSourceIngestion('prensa_libre_gt')
}

export async function runNewsSourceIngestion(sourceCode: string): Promise<NewsIngestionResultDto> {
  const res = await authFetch(`/api/news/sources/${encodeURIComponent(sourceCode)}/ingest`, {
    method: 'POST',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Error al ejecutar la ingesta')
  }
  return res.json() as Promise<NewsIngestionResultDto>
}

export async function estimateNewsSourceIngestion(sourceCode: string): Promise<Record<string, unknown>> {
  const res = await authFetch(`/api/news/sources/${encodeURIComponent(sourceCode)}/inspect`, {
    method: 'POST',
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Error al estimar la ingesta')
  }
  return res.json() as Promise<Record<string, unknown>>
}

export async function fetchNewsIngestionRuns(sourceId?: string): Promise<NewsIngestionRunDto[]> {
  const params = new URLSearchParams()
  if (sourceId) params.set('source_id', sourceId)
  const qs = params.toString()
  const res = await authFetch(`/api/news/ingestion-runs${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error('No se pudo cargar el historial de ingestas')
  const data = (await res.json()) as { items: NewsIngestionRunDto[] }
  return data.items
}

export async function inspectPrensaLibreSource(): Promise<Record<string, unknown>> {
  return estimateNewsSourceIngestion('prensa_libre_gt')
}
