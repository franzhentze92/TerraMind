import {
  buildFirmsAreaCsvUrl,
  FIRMS_DAY_RANGE,
  FIRMS_INGEST_SOURCES,
  type FirmsSourceProduct,
} from '@/pipeline/connectors/firms.config'
import {
  fetchFirmsSourceCsv,
  FirmsApiError,
  sanitizeFirmsUrl,
} from '@/pipeline/connectors/firms.connector'
import {
  buildUtcTimestamp,
  mapConfidenceNormalized,
  type FirmsRow,
} from '@/pipeline/connectors/firms.parser'
import { buildFireDedupKey } from '@/pipeline/engines/fire/dedup'
import type { FireDetectionRow } from '@/pipeline/stores/fire.types'
import {
  completeIngestionRun,
  createIngestionRun,
  upsertFireDetections,
} from '@/pipeline/stores/supabase.fire.store'

export interface IngestOptions {
  dryRun?: boolean
  sources?: FirmsSourceProduct[]
}

export interface SourceIngestResult {
  source: FirmsSourceProduct
  httpStatus: number
  rowsReceived: number
  rowsValid: number
  rowsRejected: number
  error?: string
}

export interface IngestResult {
  runId: string | null
  status: 'success' | 'partial' | 'failed' | 'dry-run'
  sources: SourceIngestResult[]
  rowsReceived: number
  rowsValid: number
  rowsRejected: number
  rowsInserted: number
  rowsUpdated: number
  rowsDuplicated: number
  durationMs: number
  errors: string[]
}

function normalizeRow(
  row: FirmsRow,
  sourceProduct: FirmsSourceProduct,
  ingestionRunId: string,
  ingestedAt: string,
): FireDetectionRow | null {
  const acquiredAtUtc = buildUtcTimestamp(row.acqDate, row.acqTime)
  if (!acquiredAtUtc) return null

  const dedupKey = buildFireDedupKey(
    sourceProduct,
    row.latitude,
    row.longitude,
    acquiredAtUtc,
  )

  return {
    dedup_key: dedupKey,
    ingestion_run_id: ingestionRunId,
    source_product: sourceProduct,
    satellite: row.satellite || null,
    instrument: row.instrument || null,
    data_version: row.version || null,
    latitude: row.latitude,
    longitude: row.longitude,
    acquired_at_utc: acquiredAtUtc,
    first_seen_at: ingestedAt,
    last_seen_at: ingestedAt,
    ingested_at: ingestedAt,
    confidence_raw: row.confidence || null,
    confidence_normalized: mapConfidenceNormalized(row.confidence),
    detection_label: 'Foco de calor detectado',
    frp_mw: row.frp,
    brightness: row.brightTi4,
    daynight: row.daynight && ['D', 'N'].includes(row.daynight) ? row.daynight : null,
    country_code: null,
    is_inside_guatemala: null,
    department_id: null,
    municipality_id: null,
    geography_method: 'unresolved',
    geography_confidence: null,
    raw_payload: {
      latitude: row.latitude,
      longitude: row.longitude,
      bright_ti4: row.brightTi4,
      bright_ti5: row.brightTi5,
      scan: row.scan,
      track: row.track,
      acq_date: row.acqDate,
      acq_time: row.acqTime,
      satellite: row.satellite,
      instrument: row.instrument,
      confidence: row.confidence,
      version: row.version,
      frp: row.frp,
      daynight: row.daynight,
      source_product: sourceProduct,
    },
  }
}

function resolveStatus(
  sourceResults: SourceIngestResult[],
  errors: string[],
): 'success' | 'partial' | 'failed' {
  const succeeded = sourceResults.filter((s) => !s.error).length
  if (succeeded === 0) return 'failed'
  if (errors.length > 0 || succeeded < sourceResults.length) return 'partial'
  return 'success'
}

export async function runFireIngestion(options: IngestOptions = {}): Promise<IngestResult> {
  const start = Date.now()
  const sources = options.sources ?? [...FIRMS_INGEST_SOURCES]
  const ingestedAt = new Date().toISOString()
  const sanitizedUrls = sources.map((s) =>
    sanitizeFirmsUrl(buildFirmsAreaCsvUrl('[REDACTED]', s)),
  )

  const sourceResults: SourceIngestResult[] = []
  const errors: string[] = []
  const normalizedRows: FireDetectionRow[] = []

  let runId: string | null = null

  if (!options.dryRun) {
    runId = await createIngestionRun({
      sources_queried: sources,
      day_range: FIRMS_DAY_RANGE,
      sanitized_request: sanitizedUrls,
    })
    console.log(`Ingestion run created: ${runId}`)
  }

  const ingestionRunId = runId ?? 'dry-run'

  for (const source of sources) {
    const sourceStart = Date.now()
    try {
      const result = await fetchFirmsSourceCsv(source)
      const rowsReceived = result.stats.totalLines
      const rowsValid = result.rows.length
      const rowsRejected = result.stats.skippedRows

      for (const row of result.rows) {
        const normalized = normalizeRow(row, source, ingestionRunId, ingestedAt)
        if (normalized) normalizedRows.push(normalized)
      }

      sourceResults.push({
        source,
        httpStatus: result.status,
        rowsReceived,
        rowsValid,
        rowsRejected,
      })

      console.log(
        `[${source}] ${rowsValid} valid · ${rowsRejected} rejected · ` +
          `${Date.now() - sourceStart}ms · HTTP ${result.status}`,
      )
    } catch (err) {
      const message =
        err instanceof FirmsApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Error desconocido'

      errors.push(`${source}: ${message}`)
      sourceResults.push({
        source,
        httpStatus: err instanceof FirmsApiError ? (err.status ?? 0) : 0,
        rowsReceived: 0,
        rowsValid: 0,
        rowsRejected: 0,
        error: message,
      })
      console.error(`[${source}] FAILED: ${message}`)
    }
  }

  const rowsReceived = sourceResults.reduce((s, r) => s + r.rowsReceived, 0)
  const rowsValid = normalizedRows.length
  const rowsRejected = sourceResults.reduce((s, r) => s + r.rowsRejected, 0)

  let rowsInserted = 0
  let rowsUpdated = 0
  let rowsDuplicated = 0

  if (!options.dryRun && normalizedRows.length > 0) {
    const metrics = await upsertFireDetections(normalizedRows)
    rowsInserted = metrics.inserted
    rowsUpdated = metrics.updated
    rowsDuplicated = metrics.duplicated
  }

  const durationMs = Date.now() - start
  const status = options.dryRun ? 'dry-run' : resolveStatus(sourceResults, errors)

  const httpStatus = Object.fromEntries(
    sourceResults.map((s) => [s.source, s.httpStatus]),
  )

  if (!options.dryRun && runId) {
    await completeIngestionRun(runId, {
      status,
      completed_at: new Date().toISOString(),
      http_status: httpStatus,
      rows_received: rowsReceived,
      rows_valid: rowsValid,
      rows_rejected: rowsRejected,
      rows_inserted: rowsInserted,
      rows_updated: rowsUpdated,
      rows_duplicated: rowsDuplicated,
      rows_outside_country: 0,
      duration_ms: durationMs,
      error_message: errors.length ? errors.join('; ') : null,
      metadata: {
        sources: sourceResults,
      },
    })
  }

  return {
    runId,
    status,
    sources: sourceResults,
    rowsReceived,
    rowsValid,
    rowsRejected,
    rowsInserted,
    rowsUpdated,
    rowsDuplicated,
    durationMs,
    errors,
  }
}
