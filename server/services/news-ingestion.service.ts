/**
 * News ingestion orchestration (Bloque N1 — multi-fuente).
 *
 * Flujo optimizado por documento:
 *   sitemap → normalizar URL → hash canónico → buscar existente →
 *   decidir revalidación (lastmod / ventana por tipo) → fetch solo si aplica.
 */
import {
  fetchNormalizedWithOptionalRateLimit,
  resolveProvisionalCanonicalUrl,
} from '@/modules/news/connectors/news-source-connector'
import { getNewsConnector } from '@/modules/news/connectors/registry'
import { classifyPreliminaryCategory } from '@/modules/news/engines/preliminary-classifier'
import {
  GEOLOCATOR_VERSION,
  inferPreliminaryGeography,
} from '@/modules/news/engines/preliminary-geolocator'
import { decideRevalidation } from '@/modules/news/engines/revalidation-policy'
import { hashCanonicalUrl, hashDocumentContent } from '@/modules/news/engines/url-normalizer'
import { SafeFetchError } from '@/modules/news/engines/safe-http-client'
import type {
  DiscoveredNewsItem,
  NormalizedNewsDocument,
  SourceInspectionReport,
} from '@/modules/news/types/news.types'
import {
  createIngestionRun,
  finishIngestionRun,
  getNewsDocumentByHash,
  getNewsSourceByCode,
  insertNewsDocument,
  listDocumentsForReprocess,
  mapIngestionRunRow,
  mapSourceRow,
  touchDocumentRevalidated,
  updateNewsDocument,
  updateNewsSourceAfterIngestion,
  type NewsDocumentRow,
  type NewsIngestionRunRow,
} from '@/pipeline/stores/news.store'

/** Hash de contenido canónico (estable entre corridas). */
function computeContentHash(doc: {
  title: string
  description?: string | null
  modifiedAt?: string | null
  publishedAt?: string | null
}): string {
  return hashDocumentContent([
    doc.title,
    doc.description ?? '',
    doc.modifiedAt ?? '',
    doc.publishedAt ?? '',
  ])
}

interface DerivedInput {
  title: string
  description?: string | null
  sourceCategory?: string | null
  sourceTags?: string[]
  canonicalUrl: string
}

/** Clasificación + geolocalización determinísticas (sin fetch adicional). */
function deriveAnalysis(input: DerivedInput) {
  const urlPath = (() => {
    try {
      return new URL(input.canonicalUrl).pathname
    } catch {
      return ''
    }
  })()

  const classification = classifyPreliminaryCategory({
    title: input.title,
    description: input.description,
    sourceCategory: input.sourceCategory,
    urlPath,
    sourceTags: input.sourceTags,
  })
  const geography = inferPreliminaryGeography({
    title: input.title,
    description: input.description,
    sourceCategory: input.sourceCategory,
    urlPath,
  })
  return { classification, geography }
}

async function fetchNormalized(
  connector: ReturnType<typeof getNewsConnector>,
  source: ReturnType<typeof mapSourceRow>,
  item: DiscoveredNewsItem,
): Promise<NormalizedNewsDocument> {
  return fetchNormalizedWithOptionalRateLimit(connector, source, item)
}

export async function inspectNewsSource(code: string): Promise<SourceInspectionReport> {
  const row = await getNewsSourceByCode(code)
  if (!row) throw new Error(`Fuente no registrada: ${code}`)
  const source = mapSourceRow(row)
  const connector = getNewsConnector(code)
  return connector.inspectSource(source)
}

export interface IngestionMetrics {
  discovered: number
  documentsNew: number
  documentsUpdated: number
  duplicatesNoDownload: number
  revalidated: number
  restricted: number
  errors: number
  httpRequestsMade: number
  httpRequestsAvoided: number
}

export async function runNewsIngestion(code: string): Promise<{
  run: NewsIngestionRunRow
  inspection?: SourceInspectionReport
}> {
  const row = await getNewsSourceByCode(code)
  if (!row) throw new Error(`Fuente no registrada: ${code}`)
  if (!row.is_enabled) throw new Error(`Fuente deshabilitada: ${code}`)

  const source = mapSourceRow(row)
  const connector = getNewsConnector(code)
  const inspection = await connector.inspectSource(source)
  const startedMs = Date.now()

  const run = await createIngestionRun({
    source_id: source.id,
    discovery_method: inspection.selectedDiscoveryMethod,
    connector_version: connector.version,
    result_code: 'pending',
  })

  const errorDetails: Array<Record<string, unknown>> = []
  const m: IngestionMetrics = {
    discovered: 0,
    documentsNew: 0,
    documentsUpdated: 0,
    duplicatesNoDownload: 0,
    revalidated: 0,
    restricted: 0,
    errors: 0,
    httpRequestsMade: 0,
    httpRequestsAvoided: 0,
  }

  try {
    const discovered = await connector.discoverDocuments(source)
    m.discovered = discovered.length

    for (const item of discovered) {
      try {
        const provisionalUrl = resolveProvisionalCanonicalUrl(connector, item)
        const provisionalHash = hashCanonicalUrl(provisionalUrl)
        const existing = await getNewsDocumentByHash(provisionalHash)
        const nowIso = new Date().toISOString()

        // ---- Documento ya conocido: decidir si revalidar ----
        if (existing) {
          const decision = decideRevalidation(
            {
              sitemapLastmod: item.modifiedAt ?? item.publishedAt,
              storedModifiedAt: existing.modified_at,
              storedPublishedAt: existing.published_at,
              lastCheckedAt: existing.last_revalidated_at ?? existing.updated_at,
              isLiveCoverage: existing.is_live_coverage,
              isCorrection: existing.is_correction,
            },
            source.connectorConfig,
          )

          if (!decision.fetch) {
            m.duplicatesNoDownload++
            m.httpRequestsAvoided++
            continue
          }

          const normalized = await fetchNormalized(connector, source, item)
          m.httpRequestsMade++
          const realHash = hashCanonicalUrl(normalized.canonicalUrl)
          const target =
            realHash === provisionalHash
              ? existing
              : (await getNewsDocumentByHash(realHash)) ?? existing
          const contentHash = computeContentHash(normalized)

          if (target.content_hash === contentHash) {
            m.revalidated++
            await touchDocumentRevalidated(target.id, nowIso)
            continue
          }

          await applyUpdate(target, normalized, contentHash, nowIso)
          m.documentsUpdated++
          continue
        }

        // ---- Documento nuevo ----
        const normalized = await fetchNormalized(connector, source, item)
        m.httpRequestsMade++
        const realHash = hashCanonicalUrl(normalized.canonicalUrl)
        if (realHash !== provisionalHash) {
          const already = await getNewsDocumentByHash(realHash)
          if (already) {
            m.duplicatesNoDownload++
            continue
          }
        }
        await applyInsert(source, normalized, realHash, computeContentHash(normalized), nowIso)
        m.documentsNew++
      } catch (err) {
        m.errors++
        if (err instanceof SafeFetchError && (err.status === 403 || err.status === 429)) {
          m.restricted++
          errorDetails.push({ url: item.discoveredUrl, error: err.message, status: err.status })
          break
        }
        errorDetails.push({
          url: item.discoveredUrl,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const checkpoint = connector.getNextCheckpoint(discovered)
    const touched = m.documentsNew + m.documentsUpdated
    const resultCode =
      m.errors > 0 && touched === 0 && m.revalidated === 0 && m.duplicatesNoDownload === 0
        ? m.restricted > 0
          ? 'blocked'
          : 'failed'
        : m.errors > 0
          ? 'partial'
          : 'success'

    const finished = await finishIngestionRun(run.id, {
      finished_at: new Date().toISOString(),
      urls_discovered: m.discovered,
      documents_new: m.documentsNew,
      documents_updated: m.documentsUpdated,
      duplicates: m.duplicatesNoDownload,
      revalidated: m.revalidated,
      restricted: m.restricted,
      errors: m.errors,
      http_requests_made: m.httpRequestsMade,
      http_requests_avoided: m.httpRequestsAvoided,
      duration_ms: Date.now() - startedMs,
      result_code: resultCode,
      message:
        resultCode === 'success'
          ? 'Ingesta completada'
          : resultCode === 'partial'
            ? 'Ingesta parcial con errores'
            : 'Ingesta con bloqueo o fallo',
      checkpoint,
      rate_limit_observed: { pauseMs: source.connectorConfig.rateLimitMs ?? 1500 },
      error_details: errorDetails,
    })

    await updateNewsSourceAfterIngestion(
      source.id,
      resultCode === 'success' || resultCode === 'partial',
    )
    return { run: finished, inspection }
  } catch (err) {
    const finished = await finishIngestionRun(run.id, {
      finished_at: new Date().toISOString(),
      errors: m.errors + 1,
      duration_ms: Date.now() - startedMs,
      result_code: 'failed',
      message: err instanceof Error ? err.message : 'Error de ingesta',
      error_details: [...errorDetails, { fatal: true, error: String(err) }],
    })
    await updateNewsSourceAfterIngestion(source.id, false)
    return { run: finished, inspection }
  }
}

async function applyInsert(
  source: ReturnType<typeof mapSourceRow>,
  normalized: NormalizedNewsDocument,
  canonicalHash: string,
  contentHash: string,
  nowIso: string,
): Promise<void> {
  const { classification, geography } = deriveAnalysis({
    title: normalized.title,
    description: normalized.description,
    sourceCategory: normalized.sourceCategory,
    sourceTags: normalized.sourceTags,
    canonicalUrl: normalized.canonicalUrl,
  })
  await insertNewsDocument({
    source_id: source.id,
    external_id: normalized.externalId,
    canonical_url: normalized.canonicalUrl,
    discovered_url: normalized.discoveredUrl,
    title: normalized.title,
    subtitle: normalized.subtitle ?? null,
    author_names: normalized.authorNames,
    published_at: normalized.publishedAt,
    modified_at: normalized.modifiedAt,
    captured_at: nowIso,
    source_category: normalized.sourceCategory,
    source_tags: normalized.sourceTags,
    description: normalized.description,
    permitted_excerpt: normalized.permittedExcerpt,
    image_reference_url: normalized.imageReferenceUrl,
    raw_metadata: normalized.rawMetadata,
    structured_data: {
      ...normalized.structuredData,
      geo: { version: geography.version, reason: geography.reason },
    },
    content_hash: contentHash,
    canonical_url_hash: canonicalHash,
    processing_status: 'ready_for_analysis',
    geographic_status: geography.geographicStatus,
    primary_location: geography.primaryLocation,
    location_candidates: geography.locationCandidates,
    is_opinion: normalized.isOpinion ?? false,
    is_sponsored: normalized.isSponsored ?? false,
    is_correction: normalized.isCorrection ?? false,
    is_live_coverage: normalized.isLiveCoverage ?? false,
    source_reliability_snapshot: source.reliabilityProfile,
    preliminary_category: classification.category,
    preliminary_category_confidence: classification.confidence,
    preliminary_category_reasons: classification.reasons,
    classifier_version: classification.version,
    last_revalidated_at: nowIso,
  })
}

async function applyUpdate(
  target: NewsDocumentRow,
  normalized: NormalizedNewsDocument,
  contentHash: string,
  nowIso: string,
): Promise<void> {
  const { classification, geography } = deriveAnalysis({
    title: normalized.title,
    description: normalized.description,
    sourceCategory: normalized.sourceCategory,
    sourceTags: normalized.sourceTags,
    canonicalUrl: normalized.canonicalUrl,
  })
  const prevRaw = (target.raw_metadata && typeof target.raw_metadata === 'object'
    ? (target.raw_metadata as Record<string, unknown>)
    : {}) as Record<string, unknown>
  const history = Array.isArray(prevRaw.update_history) ? (prevRaw.update_history as unknown[]) : []
  const changed = ['title', 'description', 'modified_at'].filter(
    (k) =>
      String((target as unknown as Record<string, unknown>)[k] ?? '') !==
      String(
        k === 'title'
          ? normalized.title
          : k === 'description'
            ? normalized.description ?? ''
            : normalized.modifiedAt ?? '',
      ),
  )

  await updateNewsDocument(target.id, {
    title: normalized.title,
    modified_at: normalized.modifiedAt,
    description: normalized.description,
    permitted_excerpt: normalized.permittedExcerpt,
    source_category: normalized.sourceCategory,
    source_tags: normalized.sourceTags,
    content_hash: contentHash,
    processing_status: 'ready_for_analysis',
    geographic_status: geography.geographicStatus,
    primary_location: geography.primaryLocation,
    location_candidates: geography.locationCandidates,
    preliminary_category: classification.category,
    preliminary_category_confidence: classification.confidence,
    preliminary_category_reasons: classification.reasons,
    classifier_version: classification.version,
    last_revalidated_at: nowIso,
    structured_data: { geo: { version: geography.version, reason: geography.reason } },
    raw_metadata: {
      ...prevRaw,
      update_history: [...history, { at: nowIso, fields: changed }],
    },
  })
}

/**
 * Reprocesa la geolocalización y clasificación de los documentos existentes
 * de una fuente SIN volver a descargarlos del medio.
 */
export async function reprocessSourceAnalysis(code: string): Promise<{
  total: number
  geoChanged: number
  categoryChanged: number
}> {
  const row = await getNewsSourceByCode(code)
  if (!row) throw new Error(`Fuente no registrada: ${code}`)
  const docs = await listDocumentsForReprocess(row.id)

  let geoChanged = 0
  let categoryChanged = 0

  for (const doc of docs) {
    const { classification, geography } = deriveAnalysis({
      title: doc.title,
      description: doc.description,
      sourceCategory: doc.source_category,
      sourceTags: Array.isArray(doc.source_tags) ? (doc.source_tags as string[]) : [],
      canonicalUrl: doc.canonical_url,
    })

    if (doc.geographic_status !== geography.geographicStatus) geoChanged++
    if (doc.preliminary_category !== classification.category) categoryChanged++

    const prevRaw = (doc.raw_metadata && typeof doc.raw_metadata === 'object'
      ? (doc.raw_metadata as Record<string, unknown>)
      : {}) as Record<string, unknown>

    await updateNewsDocument(doc.id, {
      geographic_status: geography.geographicStatus,
      primary_location: geography.primaryLocation,
      location_candidates: geography.locationCandidates,
      preliminary_category: classification.category,
      preliminary_category_confidence: classification.confidence,
      preliminary_category_reasons: classification.reasons,
      classifier_version: classification.version,
      structured_data: {
        ...(doc.structured_data && typeof doc.structured_data === 'object'
          ? (doc.structured_data as Record<string, unknown>)
          : {}),
        geo: { version: geography.version, reason: geography.reason },
      },
      raw_metadata: {
        ...prevRaw,
        reprocessed_at: new Date().toISOString(),
        geolocator_version: GEOLOCATOR_VERSION,
      },
    })
  }

  return { total: docs.length, geoChanged, categoryChanged }
}

export function mapRunDto(run: NewsIngestionRunRow, sourceName: string) {
  const mapped = mapIngestionRunRow(run)
  return {
    id: mapped.id,
    source_id: mapped.sourceId,
    source_name: sourceName,
    started_at: mapped.startedAt,
    finished_at: mapped.finishedAt,
    discovery_method: mapped.discoveryMethod,
    urls_discovered: mapped.urlsDiscovered,
    documents_new: mapped.documentsNew,
    documents_updated: mapped.documentsUpdated,
    duplicates: mapped.duplicates,
    revalidated: mapped.revalidated,
    restricted: mapped.restricted,
    errors: mapped.errors,
    http_requests_made: mapped.httpRequestsMade,
    http_requests_avoided: mapped.httpRequestsAvoided,
    duration_ms: mapped.durationMs,
    result_code: mapped.resultCode,
    message: mapped.message,
    connector_version: mapped.connectorVersion,
  }
}
