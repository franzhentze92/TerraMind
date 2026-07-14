/**
 * News API service (Bloque N1 / N1.5).
 */
import type { RequestAuthContext } from '@/core/auth/permissions'
import { listRegisteredConnectors } from '@/modules/news/connectors/registry'
import { deriveSourceHealth } from '@/modules/news/engines/source-health'
import {
  ACCESS_POLICY_LABELS,
  CONTENT_RETENTION_LABELS,
  geographicStatusLabel,
  preliminaryCategoryLabel,
  processingStatusLabel,
} from '@/modules/news/presentation/news-labels'
import type {
  NewsDocumentDetailDto,
  NewsDocumentListItemDto,
  NewsIngestionRunDto,
  NewsIngestionResultDto,
  NewsSourceDto,
  NewsSummaryDto,
} from '@/modules/news/types/news-dto.types'
import {
  getNewsDocumentById,
  getNewsSourceByCode,
  getNewsSummary,
  listIngestionRuns,
  listNewsDocuments,
  listNewsSources,
  mapDocumentRow,
  mapSourceRow,
  type NewsDocumentRow,
  type NewsSourceRow,
} from '@/pipeline/stores/news.store'
import {
  inspectNewsSource,
  mapRunDto,
  reprocessSourceAnalysis,
  runNewsIngestion,
} from './news-ingestion.service'

interface StoredPrimaryLocation {
  name?: string
  departmentName?: string
  municipalityName?: string
  latitude?: number
  longitude?: number
  level?: string
}

function locationLabel(row: NewsDocumentRow): string | null {
  const loc = row.primary_location as StoredPrimaryLocation | null
  if (!loc) return null
  // Nacional/internacional no representan un lugar puntual: se muestran vía el
  // estado geográfico, no como etiqueta territorial.
  if (loc.level === 'national' || loc.level === 'international') return null
  return loc.municipalityName ?? loc.departmentName ?? loc.name ?? null
}

/**
 * Texto de ubicación específico y honesto según el estado geográfico.
 * Nunca muestra simplemente "Guatemala" con estado "Localizada".
 */
function locationDisplay(row: NewsDocumentRow): string {
  const loc = row.primary_location as StoredPrimaryLocation | null
  switch (row.geographic_status) {
    case 'localizada':
      return loc?.name ?? 'Ubicación localizada'
    case 'ubicacion_aproximada':
      if (loc?.municipalityName) return loc.municipalityName
      return `Departamento de ${loc?.departmentName ?? loc?.name ?? 'Guatemala'}`
    case 'varias_ubicaciones': {
      const base = loc?.municipalityName ?? loc?.departmentName ?? loc?.name
      return base ? `${base} y otras ubicaciones` : 'Varias ubicaciones'
    }
    case 'nacional':
      return 'Cobertura nacional'
    case 'internacional':
      return 'Internacional'
    default:
      return 'Sin ubicación suficiente'
  }
}

function toListItem(row: NewsDocumentRow, source?: NewsSourceRow): NewsDocumentListItemDto {
  const doc = mapDocumentRow(row)
  return {
    id: doc.id,
    source_id: doc.sourceId,
    source_name: source?.name ?? 'Fuente desconocida',
    source_code: source?.code ?? '',
    title: doc.title,
    canonical_url: doc.canonicalUrl,
    published_at: doc.publishedAt,
    source_category: doc.sourceCategory,
    preliminary_category: doc.preliminaryCategory,
    preliminary_category_label: preliminaryCategoryLabel(doc.preliminaryCategory),
    geographic_status: doc.geographicStatus,
    geographic_status_label: geographicStatusLabel(doc.geographicStatus),
    location_label: locationLabel(row),
    processing_status: doc.processingStatus,
    processing_status_label: processingStatusLabel(doc.processingStatus),
    permitted_excerpt: doc.permittedExcerpt,
    image_reference_url: doc.imageReferenceUrl,
    location_display: locationDisplay(row),
    primary_location: doc.primaryLocation
      ? {
          name: doc.primaryLocation.name,
          department_name: doc.primaryLocation.departmentName,
          municipality_name: doc.primaryLocation.municipalityName,
          latitude: doc.primaryLocation.latitude,
          longitude: doc.primaryLocation.longitude,
          level: doc.primaryLocation.level,
        }
      : null,
  }
}

export async function listNewsSourcesDto(): Promise<NewsSourceDto[]> {
  const rows = await listNewsSources()
  return rows.map((row) => {
    const s = mapSourceRow(row)
    const health = deriveSourceHealth({
      isEnabled: s.isEnabled,
      discoveryMethod: s.discoveryMethod,
      baseUrl: s.baseUrl,
      consecutiveFailureCount: s.consecutiveFailureCount,
      lastSuccessfulIngestionAt: s.lastSuccessfulIngestionAt,
      lastFailedIngestionAt: s.lastFailedIngestionAt,
      hasConnector: listRegisteredConnectors().includes(s.code),
    })
    return {
      id: s.id,
      code: s.code,
      name: s.name,
      source_type: s.sourceType,
      country_code: s.countryCode,
      primary_language: s.primaryLanguage,
      base_url: s.baseUrl,
      logo_url: s.logoUrl,
      discovery_method: s.discoveryMethod,
      is_enabled: s.isEnabled,
      last_successful_ingestion_at: s.lastSuccessfulIngestionAt,
      last_failed_ingestion_at: s.lastFailedIngestionAt,
      consecutive_failure_count: s.consecutiveFailureCount,
      health_code: health.code,
      health_label: health.label,
      attribution_label: 'Fuente periodística',
    }
  })
}

export async function listNewsDocumentsDto(filters: {
  source_id?: string
  category?: string
  department_code?: string
  geographic_status?: string
  processing_status?: string
  published_from?: string
  published_to?: string
  search?: string
  limit?: number
  cursor?: string
}): Promise<{ items: NewsDocumentListItemDto[]; next_cursor: string | null }> {
  const sources = await listNewsSources()
  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const { rows, nextCursor } = await listNewsDocuments({
    sourceId: filters.source_id,
    category: filters.category,
    departmentCode: filters.department_code,
    geographicStatus: filters.geographic_status,
    processingStatus: filters.processing_status,
    publishedFrom: filters.published_from,
    publishedTo: filters.published_to,
    search: filters.search,
    limit: filters.limit,
    cursor: filters.cursor,
  })
  return {
    items: rows.map((row) => toListItem(row, sourceById.get(row.source_id))),
    next_cursor: nextCursor,
  }
}

export async function getNewsDocumentDetailDto(id: string): Promise<NewsDocumentDetailDto | null> {
  const row = await getNewsDocumentById(id)
  if (!row) return null
  const source = await getNewsSourceByCode(
    (await listNewsSources()).find((s) => s.id === row.source_id)?.code ?? '',
  )
  const base = toListItem(row, source ?? undefined)
  const doc = mapDocumentRow(row)
  const history = Array.isArray(doc.rawMetadata.update_history)
    ? (doc.rawMetadata.update_history as Array<{ at: string; fields: string[] }>)
    : []

  return {
    ...base,
    subtitle: doc.subtitle,
    author_names: doc.authorNames,
    modified_at: doc.modifiedAt,
    captured_at: doc.capturedAt,
    description: doc.description,
    source_tags: doc.sourceTags,
    access_policy_label: source ? ACCESS_POLICY_LABELS[source.access_policy] ?? source.access_policy : 'Desconocida',
    content_retention_label: source
      ? CONTENT_RETENTION_LABELS[source.content_retention_policy] ?? source.content_retention_policy
      : 'Desconocida',
    preliminary_category_confidence: doc.preliminaryCategoryConfidence,
    preliminary_category_reasons: doc.preliminaryCategoryReasons,
    location_candidates: doc.locationCandidates.map((c) => ({
      name: c.name,
      department_name: c.departmentName,
      confidence: c.confidence,
      evidence: c.evidence,
      level: c.level,
    })),
    system_analysis: {
      category_proposed: preliminaryCategoryLabel(doc.preliminaryCategory),
      category_confidence: doc.preliminaryCategoryConfidence,
      category_reasons: doc.preliminaryCategoryReasons,
      location_proposed: locationDisplay(row),
      location_confidence: doc.primaryLocation?.confidence ?? null,
      geographic_status_label: geographicStatusLabel(doc.geographicStatus),
      event_grouping_status: 'Esta noticia todavía no ha sido agrupada en un evento.',
    },
    provenance: {
      source_name: source?.name ?? 'Fuente desconocida',
      source_kind_label: 'Fuente periodística',
      discovery_method: source?.discovery_method ?? 'news_sitemap',
      captured_at: doc.capturedAt,
      canonical_url: doc.canonicalUrl,
    },
    update_history: history,
    raw_metadata_summary: {
      external_id: doc.externalId,
      is_opinion: doc.isOpinion,
      is_live_coverage: doc.isLiveCoverage,
    },
  }
}

export async function getNewsSummaryDto(periodHours = 168): Promise<NewsSummaryDto> {
  const summary = await getNewsSummary(periodHours)
  return {
    documents_captured: summary.documentsCaptured,
    active_sources: summary.activeSources,
    last_ingestion_at: summary.lastIngestionAt,
    documents_with_location: summary.documentsWithLocation,
    ready_for_analysis: summary.readyForAnalysis,
    total_ingestion_runs: summary.totalIngestionRuns,
    geographic_distribution: summary.geographicDistribution,
    period_hours: periodHours,
  }
}

export async function listNewsIngestionRunsDto(sourceId?: string): Promise<NewsIngestionRunDto[]> {
  const sources = await listNewsSources()
  const sourceById = new Map(sources.map((s) => [s.id, s.name]))
  const rows = await listIngestionRuns(sourceId)
  return rows.map((row) => mapRunDto(row, sourceById.get(row.source_id) ?? 'Fuente'))
}

export async function inspectPrensaLibreSource(_auth: RequestAuthContext) {
  return inspectNewsSource('prensa_libre_gt')
}

export async function ingestPrensaLibre(_auth: RequestAuthContext): Promise<NewsIngestionResultDto> {
  return ingestNewsSourceByCode(_auth, 'prensa_libre_gt')
}

export async function reprocessPrensaLibre(_auth: RequestAuthContext) {
  return reprocessSourceAnalysis('prensa_libre_gt')
}

/** Ingesta genérica por código de fuente (multi-fuente). */
export async function ingestNewsSourceByCode(
  _auth: RequestAuthContext,
  code: string,
): Promise<NewsIngestionResultDto> {
  const source = await getNewsSourceByCode(code)
  if (!source) throw new Error(`Fuente no registrada: ${code}`)
  const result = await runNewsIngestion(code)
  return {
    run: mapRunDto(result.run, source.name),
    inspection: result.inspection as unknown as Record<string, unknown> | undefined,
  }
}

export async function inspectNewsSourceByCode(_auth: RequestAuthContext, code: string) {
  return inspectNewsSource(code)
}

export async function reprocessNewsSourceByCode(_auth: RequestAuthContext, code: string) {
  return reprocessSourceAnalysis(code)
}
