import type { FirmsSourceProduct } from '@/pipeline/connectors/firms.config'
import { FIRMS_INGEST_SOURCES } from '@/pipeline/connectors/firms.config'
import type { FireDataStatusDto } from '@/modules/fires/types/fire.dto'

export interface IngestionSourceStatus {
  source: string
  httpStatus: number
  error?: string
}

export interface ParsedIngestionStatus {
  sources_expected: number
  sources_queried_successfully: number
  sources_failed: number
  failed_source_names: string[]
  ingestion_status: 'success' | 'partial' | 'failed' | 'running' | string
  is_partial: boolean
  observations_downloaded: number
}

export function parseIngestionRunStatus(input: {
  status: string
  sources_queried: string[] | null
  http_status: Record<string, number> | null
  rows_received: number | null
  metadata?: { sources?: IngestionSourceStatus[] } | null
}): ParsedIngestionStatus {
  const sourcesQueried = input.sources_queried ?? [...FIRMS_INGEST_SOURCES]
  const httpStatus = input.http_status ?? {}
  const failedSourceNames: string[] = []

  for (const source of sourcesQueried) {
    const code = httpStatus[source]
    const meta = input.metadata?.sources?.find((s) => s.source === source)
    const effectiveStatus = code ?? meta?.httpStatus ?? 0
    const hasError = Boolean(meta?.error)
    if (hasError || effectiveStatus < 200 || effectiveStatus >= 400) {
      failedSourceNames.push(source)
    }
  }

  const sourcesFailed = failedSourceNames.length
  const sourcesQueriedSuccessfully = sourcesQueried.length - sourcesFailed
  const ingestionStatus = input.status
  const isPartial =
    ingestionStatus === 'partial' ||
    sourcesFailed > 0

  return {
    sources_expected: sourcesQueried.length || FIRMS_INGEST_SOURCES.length,
    sources_queried_successfully: sourcesQueriedSuccessfully,
    sources_failed: sourcesFailed,
    failed_source_names: failedSourceNames,
    ingestion_status: ingestionStatus,
    is_partial: isPartial,
    observations_downloaded: input.rows_received ?? 0,
  }
}

export function buildFireDataStatus(input: {
  lastFirmsIngestionAt: string | null
  lastSuccessfulIngestionAt: string | null
  latestSatelliteAcquisitionAt: string | null
  sourcesWithDetections: number
  ingestion: ParsedIngestionStatus
  isStale: boolean
  staleAfterMinutes: number
}): FireDataStatusDto {
  return {
    last_firms_ingestion_at: input.lastFirmsIngestionAt,
    last_successful_ingestion_at: input.lastSuccessfulIngestionAt,
    latest_satellite_acquisition_at: input.latestSatelliteAcquisitionAt,
    sources_expected: input.ingestion.sources_expected,
    sources_queried_successfully: input.ingestion.sources_queried_successfully,
    sources_with_detections: input.sourcesWithDetections,
    sources_failed: input.ingestion.sources_failed,
    failed_source_names: input.ingestion.failed_source_names,
    ingestion_status: input.ingestion.ingestion_status,
    is_partial: input.ingestion.is_partial,
    is_stale: input.isStale,
    stale_after_minutes: input.staleAfterMinutes,
    observations_downloaded: input.ingestion.observations_downloaded,
  }
}

export function countSourcesWithDetections(
  sourceProducts: string[],
  expected: readonly FirmsSourceProduct[] = FIRMS_INGEST_SOURCES,
): number {
  const distinct = new Set(sourceProducts)
  return expected.filter((s) => distinct.has(s)).length
}
