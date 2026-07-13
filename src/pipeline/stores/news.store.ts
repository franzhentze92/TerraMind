/**
 * News intelligence store (Bloque N1). Server-only.
 */
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'
import type {
  NewsDocument,
  NewsIngestionRun,
  NewsSource,
  NormalizedNewsDocument,
} from '@/modules/news/types/news.types'

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v))
  return []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export interface NewsSourceRow {
  id: string
  code: string
  name: string
  source_type: string
  country_code: string
  primary_language: string
  base_url: string
  logo_url: string | null
  discovery_method: string
  feed_urls: unknown
  sitemap_urls: unknown
  robots_url: string | null
  access_policy: string
  content_retention_policy: string
  reliability_profile: unknown
  geographic_coverage: unknown
  thematic_coverage: unknown
  is_enabled: boolean
  ingestion_frequency_minutes: number
  last_successful_ingestion_at: string | null
  last_failed_ingestion_at: string | null
  consecutive_failure_count: number
  connector_config: unknown
  metadata: unknown
  created_at: string
  updated_at: string
}

export interface NewsDocumentRow {
  id: string
  source_id: string
  organization_id: string | null
  external_id: string | null
  canonical_url: string
  discovered_url: string
  title: string
  subtitle: string | null
  author_names: unknown
  published_at: string | null
  modified_at: string | null
  captured_at: string
  source_category: string | null
  source_tags: unknown
  language: string
  country_code: string
  description: string | null
  permitted_excerpt: string | null
  image_reference_url: string | null
  raw_metadata: unknown
  structured_data: unknown
  content_hash: string
  canonical_url_hash: string
  processing_status: string
  geographic_status: string
  primary_location: unknown
  location_candidates: unknown
  is_opinion: boolean
  is_sponsored: boolean
  is_correction: boolean
  is_live_coverage: boolean
  source_reliability_snapshot: unknown
  preliminary_category: string | null
  preliminary_category_confidence: number | null
  preliminary_category_reasons: unknown
  classifier_version: string | null
  last_revalidated_at: string | null
  created_at: string
  updated_at: string
}

export interface NewsIngestionRunRow {
  id: string
  source_id: string
  started_at: string
  finished_at: string | null
  discovery_method: string
  urls_discovered: number
  documents_new: number
  documents_updated: number
  duplicates: number
  restricted: number
  errors: number
  result_code: string
  message: string | null
  checkpoint: unknown
  rate_limit_observed: unknown
  connector_version: string
  error_details: unknown
  revalidated: number
  http_requests_made: number
  http_requests_avoided: number
  duration_ms: number | null
  created_at: string
}

export function mapSourceRow(row: NewsSourceRow): NewsSource {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sourceType: row.source_type as NewsSource['sourceType'],
    countryCode: row.country_code,
    primaryLanguage: row.primary_language,
    baseUrl: row.base_url,
    logoUrl: row.logo_url,
    discoveryMethod: row.discovery_method as NewsSource['discoveryMethod'],
    feedUrls: asStringArray(row.feed_urls),
    sitemapUrls: asStringArray(row.sitemap_urls),
    robotsUrl: row.robots_url,
    accessPolicy: row.access_policy as NewsSource['accessPolicy'],
    contentRetentionPolicy: row.content_retention_policy as NewsSource['contentRetentionPolicy'],
    reliabilityProfile: asRecord(row.reliability_profile),
    geographicCoverage: asRecord(row.geographic_coverage),
    thematicCoverage: asStringArray(row.thematic_coverage),
    isEnabled: row.is_enabled,
    ingestionFrequencyMinutes: row.ingestion_frequency_minutes,
    lastSuccessfulIngestionAt: row.last_successful_ingestion_at,
    lastFailedIngestionAt: row.last_failed_ingestion_at,
    consecutiveFailureCount: row.consecutive_failure_count,
    connectorConfig: asRecord(row.connector_config) as NewsSource['connectorConfig'],
    metadata: asRecord(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapDocumentRow(row: NewsDocumentRow): NewsDocument {
  return {
    id: row.id,
    sourceId: row.source_id,
    organizationId: row.organization_id,
    externalId: row.external_id,
    canonicalUrl: row.canonical_url,
    discoveredUrl: row.discovered_url,
    title: row.title,
    subtitle: row.subtitle,
    authorNames: asStringArray(row.author_names),
    publishedAt: row.published_at,
    modifiedAt: row.modified_at,
    capturedAt: row.captured_at,
    sourceCategory: row.source_category,
    sourceTags: asStringArray(row.source_tags),
    language: row.language,
    countryCode: row.country_code,
    description: row.description,
    permittedExcerpt: row.permitted_excerpt,
    imageReferenceUrl: row.image_reference_url,
    rawMetadata: asRecord(row.raw_metadata),
    structuredData: asRecord(row.structured_data),
    contentHash: row.content_hash,
    canonicalUrlHash: row.canonical_url_hash,
    processingStatus: row.processing_status as NewsDocument['processingStatus'],
    geographicStatus: row.geographic_status as NewsDocument['geographicStatus'],
    primaryLocation: (row.primary_location as NewsDocument['primaryLocation']) ?? null,
    locationCandidates: Array.isArray(row.location_candidates)
      ? (row.location_candidates as NewsDocument['locationCandidates'])
      : [],
    isOpinion: row.is_opinion,
    isSponsored: row.is_sponsored,
    isCorrection: row.is_correction,
    isLiveCoverage: row.is_live_coverage,
    sourceReliabilitySnapshot: asRecord(row.source_reliability_snapshot),
    preliminaryCategory: row.preliminary_category as NewsDocument['preliminaryCategory'],
    preliminaryCategoryConfidence: row.preliminary_category_confidence,
    preliminaryCategoryReasons: asStringArray(row.preliminary_category_reasons),
    classifierVersion: row.classifier_version,
    lastRevalidatedAt: row.last_revalidated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapIngestionRunRow(row: NewsIngestionRunRow): NewsIngestionRun {
  return {
    id: row.id,
    sourceId: row.source_id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    discoveryMethod: row.discovery_method as NewsIngestionRun['discoveryMethod'],
    urlsDiscovered: row.urls_discovered,
    documentsNew: row.documents_new,
    documentsUpdated: row.documents_updated,
    duplicates: row.duplicates,
    restricted: row.restricted,
    errors: row.errors,
    resultCode: row.result_code as NewsIngestionRun['resultCode'],
    message: row.message,
    checkpoint: asRecord(row.checkpoint),
    rateLimitObserved: asRecord(row.rate_limit_observed),
    connectorVersion: row.connector_version,
    errorDetails: Array.isArray(row.error_details) ? row.error_details : [],
    revalidated: Number(row.revalidated ?? 0),
    httpRequestsMade: Number(row.http_requests_made ?? 0),
    httpRequestsAvoided: Number(row.http_requests_avoided ?? 0),
    durationMs: row.duration_ms ?? null,
    createdAt: row.created_at,
  }
}

export async function listNewsSources(): Promise<NewsSourceRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_sources')
    .select('*')
    .order('name')
  if (error) throw error
  return (data ?? []) as NewsSourceRow[]
}

export async function getNewsSourceByCode(code: string): Promise<NewsSourceRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_sources')
    .select('*')
    .eq('code', code)
    .maybeSingle()
  if (error) throw error
  return (data as NewsSourceRow | null) ?? null
}

export async function getNewsDocumentByHash(
  canonicalUrlHash: string,
): Promise<NewsDocumentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_documents')
    .select('*')
    .eq('canonical_url_hash', canonicalUrlHash)
    .maybeSingle()
  if (error) throw error
  return (data as NewsDocumentRow | null) ?? null
}

export async function insertNewsDocument(
  row: Record<string, unknown>,
): Promise<NewsDocumentRow> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_documents')
    .insert(row)
    .select('*')
    .single()
  if (error) throw error
  return data as NewsDocumentRow
}

export async function updateNewsDocument(
  id: string,
  patch: Record<string, unknown>,
): Promise<NewsDocumentRow> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_documents')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as NewsDocumentRow
}

export async function createIngestionRun(
  row: Record<string, unknown>,
): Promise<NewsIngestionRunRow> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_ingestion_runs')
    .insert(row)
    .select('*')
    .single()
  if (error) throw error
  return data as NewsIngestionRunRow
}

export async function finishIngestionRun(
  id: string,
  patch: Record<string, unknown>,
): Promise<NewsIngestionRunRow> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_ingestion_runs')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as NewsIngestionRunRow
}

export async function updateNewsSourceAfterIngestion(
  id: string,
  success: boolean,
): Promise<void> {
  const admin = getSupabaseAdmin()
  const { data: current } = await admin.from('news_sources').select('consecutive_failure_count').eq('id', id).single()
  const failures = Number((current as { consecutive_failure_count?: number } | null)?.consecutive_failure_count ?? 0)
  const patch = success
    ? {
        last_successful_ingestion_at: new Date().toISOString(),
        consecutive_failure_count: 0,
      }
    : {
        last_failed_ingestion_at: new Date().toISOString(),
        consecutive_failure_count: failures + 1,
      }
  const { error } = await admin.from('news_sources').update(patch).eq('id', id)
  if (error) throw error
}

export interface NewsDocumentListFilters {
  sourceId?: string
  category?: string
  departmentCode?: string
  geographicStatus?: string
  processingStatus?: string
  publishedFrom?: string
  publishedTo?: string
  search?: string
  limit?: number
  cursor?: string
}

export async function listNewsDocuments(
  filters: NewsDocumentListFilters,
): Promise<{ rows: NewsDocumentRow[]; nextCursor: string | null }> {
  const limit = Math.min(filters.limit ?? 50, 100)
  let query = getSupabaseAdmin()
    .from('news_documents')
    .select('*')
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (filters.sourceId) query = query.eq('source_id', filters.sourceId)
  if (filters.category) query = query.eq('preliminary_category', filters.category)
  if (filters.geographicStatus) query = query.eq('geographic_status', filters.geographicStatus)
  if (filters.processingStatus) query = query.eq('processing_status', filters.processingStatus)
  if (filters.publishedFrom) query = query.gte('published_at', filters.publishedFrom)
  if (filters.publishedTo) query = query.lte('published_at', filters.publishedTo)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)
  if (filters.departmentCode) {
    query = query.contains('primary_location', { departmentCode: filters.departmentCode })
  }
  if (filters.cursor) {
    query = query.lt('published_at', filters.cursor)
  }

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as NewsDocumentRow[]
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? page.at(-1)?.published_at ?? null : null
  return { rows: page, nextCursor }
}

export async function listDocumentsForReprocess(sourceId: string): Promise<NewsDocumentRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_documents')
    .select('*')
    .eq('source_id', sourceId)
    .order('published_at', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data ?? []) as NewsDocumentRow[]
}

export async function touchDocumentRevalidated(id: string, at: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('news_documents')
    .update({ last_revalidated_at: at })
    .eq('id', id)
  if (error) throw error
}

export async function getNewsDocumentById(id: string): Promise<NewsDocumentRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('news_documents')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return (data as NewsDocumentRow | null) ?? null
}

export async function listIngestionRuns(sourceId?: string, limit = 20): Promise<NewsIngestionRunRow[]> {
  let query = getSupabaseAdmin()
    .from('news_ingestion_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (sourceId) query = query.eq('source_id', sourceId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as NewsIngestionRunRow[]
}

export interface NewsGeographicDistribution {
  localizada: number
  ubicacion_aproximada: number
  varias_ubicaciones: number
  nacional: number
  internacional: number
  sin_ubicacion: number
}

export async function getNewsSummary(periodHours = 168): Promise<{
  documentsCaptured: number
  activeSources: number
  lastIngestionAt: string | null
  documentsWithLocation: number
  readyForAnalysis: number
  totalIngestionRuns: number
  geographicDistribution: NewsGeographicDistribution
}> {
  const since = new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString()
  const admin = getSupabaseAdmin()

  const [docsRes, sourcesRes, lastRunRes, locatedRes, readyRes, runsCountRes, statusRowsRes] =
    await Promise.all([
      admin.from('news_documents').select('id', { count: 'exact', head: true }).gte('captured_at', since),
      admin.from('news_sources').select('id', { count: 'exact', head: true }).eq('is_enabled', true),
      admin
        .from('news_ingestion_runs')
        .select('finished_at')
        .order('finished_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from('news_documents')
        .select('id', { count: 'exact', head: true })
        // Solo cuentan las que tienen ubicación territorial mostrable en el mapa;
        // nacional/internacional/sin ubicación no se consideran "con ubicación".
        .in('geographic_status', ['localizada', 'ubicacion_aproximada', 'varias_ubicaciones'])
        .gte('captured_at', since),
      admin
        .from('news_documents')
        .select('id', { count: 'exact', head: true })
        .eq('processing_status', 'ready_for_analysis')
        .gte('captured_at', since),
      admin.from('news_ingestion_runs').select('id', { count: 'exact', head: true }),
      admin.from('news_documents').select('geographic_status').gte('captured_at', since),
    ])

  if (docsRes.error) throw docsRes.error
  if (sourcesRes.error) throw sourcesRes.error
  if (lastRunRes.error) throw lastRunRes.error
  if (locatedRes.error) throw locatedRes.error
  if (readyRes.error) throw readyRes.error
  if (runsCountRes.error) throw runsCountRes.error
  if (statusRowsRes.error) throw statusRowsRes.error

  const distribution: NewsGeographicDistribution = {
    localizada: 0,
    ubicacion_aproximada: 0,
    varias_ubicaciones: 0,
    nacional: 0,
    internacional: 0,
    sin_ubicacion: 0,
  }
  for (const row of (statusRowsRes.data ?? []) as Array<{ geographic_status: string }>) {
    const key = row.geographic_status as keyof NewsGeographicDistribution
    if (key in distribution) distribution[key] += 1
  }

  return {
    documentsCaptured: docsRes.count ?? 0,
    activeSources: sourcesRes.count ?? 0,
    lastIngestionAt: (lastRunRes.data as { finished_at?: string } | null)?.finished_at ?? null,
    documentsWithLocation: locatedRes.count ?? 0,
    readyForAnalysis: readyRes.count ?? 0,
    totalIngestionRuns: runsCountRes.count ?? 0,
    geographicDistribution: distribution,
  }
}

export type { NormalizedNewsDocument }
