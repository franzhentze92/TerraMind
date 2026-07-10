import { createLandCoverService } from '@/modules/territory/land-cover/land-cover.service'
import {
  buildLandCoverContextVersion,
  LAND_COVER_AREA_STRATEGY,
  LAND_COVER_BUFFER_UNION_METHOD,
  LAND_COVER_NODATA_POLICY,
} from '@/modules/territory/land-cover/land-cover-context-version'
import type { GeoPoint, LandCoverAnalysis } from '@/modules/territory/land-cover/land-cover.types'
import { ESA_WORLDCOVER_LAYER_CODE } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.manifest'
import {
  fetchEventDetections,
  getTerritorialLayerId,
  listLandCoverEventCandidates,
  persistLandCoverAnalysis,
  type LandCoverEventCandidate,
  type EventDetectionPoint,
} from '@/pipeline/stores/land-cover.store'

export interface LandCoverEnrichOptions {
  limit?: number
  force?: boolean
  eventId?: string
  concurrency?: number
}

export interface LandCoverEnrichResultRow {
  event_id: string
  department_name: string | null
  status: string
  dominant_point_class: string | null
  dominant_500m: string | null
  dominant_1000m: string | null
  warnings: string[]
  duration_ms: number
  used_centroid_fallback: boolean
}

export interface LandCoverEnrichMetrics {
  events_considered: number
  events_enriched: number
  events_unchanged: number
  events_failed: number
  centroid_fallback_count: number
  incomplete_coverage_count: number
  duration_ms: number
  context_version: string | null
  radii_m: number[]
  results: LandCoverEnrichResultRow[]
}

export class LandCoverSourceUnavailableError extends Error {
  constructor(message = 'Raster ESA WorldCover no disponible') {
    super(message)
    this.name = 'LandCoverSourceUnavailableError'
  }
}

function parseRadiiM(): number[] {
  const radii = [500, 1000]
  if (process.env.LAND_COVER_RADIUS_3KM_ENABLED === 'true') radii.push(3000)
  return radii
}

function parseConcurrency(): number {
  const raw = Number(process.env.LAND_COVER_ENRICHMENT_CONCURRENCY ?? 1)
  if (!Number.isFinite(raw) || raw < 1) return 1
  return Math.min(Math.floor(raw), 4)
}

function eventNeedsEnrichment(
  event: LandCoverEventCandidate,
  contextVersion: string,
  force: boolean,
): boolean {
  if (force) return true
  if (!event.context_version) return true
  if (event.context_version !== contextVersion) return true
  if (
    event.last_linked_at &&
    event.context_generated_at &&
    event.last_linked_at > event.context_generated_at
  ) {
    return true
  }
  return false
}

function resolveSamplePoints(
  detections: EventDetectionPoint[],
  centroid: { lat: number; lon: number } | null,
): { points: GeoPoint[]; usedCentroidFallback: boolean } {
  if (detections.length > 0) {
    return {
      points: detections.map((d) => ({
        id: d.id,
        lat: d.latitude,
        lon: d.longitude,
      })),
      usedCentroidFallback: false,
    }
  }
  if (centroid) {
    return {
      points: [{ lat: centroid.lat, lon: centroid.lon, id: 'centroid' }],
      usedCentroidFallback: true,
    }
  }
  return { points: [], usedCentroidFallback: false }
}

function dominantForRadius(analysis: LandCoverAnalysis, radiusM: number): string | null {
  return (
    analysis.zones.find((z) => z.radiusM === radiusM)?.distribution.dominantClass ?? null
  )
}

function toResultRow(
  event: LandCoverEventCandidate,
  analysis: LandCoverAnalysis,
  durationMs: number,
  usedCentroidFallback: boolean,
): LandCoverEnrichResultRow {
  return {
    event_id: event.id,
    department_name: event.department_name,
    status: analysis.status,
    dominant_point_class: analysis.pointDistribution.dominantClass,
    dominant_500m: dominantForRadius(analysis, 500),
    dominant_1000m: dominantForRadius(analysis, 1000),
    warnings: analysis.warnings,
    duration_ms: durationMs,
    used_centroid_fallback: usedCentroidFallback,
  }
}

async function enrichSingleEvent(
  event: LandCoverEventCandidate,
  radiiM: number[],
  sourceLayerId: string | null,
): Promise<LandCoverEnrichResultRow> {
  const started = Date.now()
  const detections = await fetchEventDetections(event.id)
  const centroid =
    event.centroid_lat != null && event.centroid_lng != null
      ? { lat: event.centroid_lat, lon: event.centroid_lng }
      : null
  const { points, usedCentroidFallback } = resolveSamplePoints(detections, centroid)

  if (points.length === 0) {
    throw new Error('Evento sin detecciones ni centroide utilizable')
  }

  const service = createLandCoverService()
  const analysis = await service.analyzeBuffers({
    points,
    radiiMeters: radiiM,
    unifyBuffers: true,
  })

  if (analysis.status === 'unavailable') {
    throw new Error('Fuente raster no disponible')
  }

  const finalAnalysis: LandCoverAnalysis = {
    ...analysis,
    status:
      analysis.status === 'error'
        ? 'partial'
        : analysis.warnings.includes('incomplete_zone_coverage')
          ? 'partial'
          : analysis.status,
  }

  await persistLandCoverAnalysis(event.id, finalAnalysis, sourceLayerId)

  return toResultRow(event, finalAnalysis, Date.now() - started, usedCentroidFallback)
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  const runners = Array.from({ length: concurrency }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await worker(current)
    }
  })
  await Promise.all(runners)
}

export async function runLandCoverEnrichment(
  options: LandCoverEnrichOptions = {},
): Promise<LandCoverEnrichMetrics> {
  const started = Date.now()
  const limit = options.limit ?? 10000
  const force = options.force ?? false
  const radiiM = parseRadiiM()
  const concurrency = options.concurrency ?? parseConcurrency()

  const service = createLandCoverService()
  const status = await service.getSourceStatus()
  if (!status.available || !status.analyticCogSha256) {
    throw new LandCoverSourceUnavailableError()
  }

  const contextVersion = buildLandCoverContextVersion({
    sourceVersion: status.sourceVersion!,
    rasterHash: status.analyticCogSha256!,
    mapperVersion: status.mapperVersion!,
    analysisMethodVersion: status.analysisMethodVersion!,
    zoneRadiiM: radiiM,
    nodataPolicy: LAND_COVER_NODATA_POLICY,
    areaStrategy: LAND_COVER_AREA_STRATEGY,
    bufferUnionMethod: LAND_COVER_BUFFER_UNION_METHOD,
  })
  const sourceLayerId = await getTerritorialLayerId(ESA_WORLDCOVER_LAYER_CODE)

  const metrics: LandCoverEnrichMetrics = {
    events_considered: 0,
    events_enriched: 0,
    events_unchanged: 0,
    events_failed: 0,
    centroid_fallback_count: 0,
    incomplete_coverage_count: 0,
    duration_ms: 0,
    context_version: contextVersion,
    radii_m: radiiM,
    results: [],
  }

  let candidates = await listLandCoverEventCandidates(limit)
  if (options.eventId) {
    candidates = candidates.filter((c) => c.id === options.eventId)
  }
  metrics.events_considered = candidates.length

  const toProcess = candidates.filter((event) =>
    eventNeedsEnrichment(event, contextVersion, force),
  )
  metrics.events_unchanged = candidates.length - toProcess.length

  await runWithConcurrency(toProcess, concurrency, async (event) => {
    try {
      const row = await enrichSingleEvent(event, radiiM, sourceLayerId)
      metrics.events_enriched += 1
      if (row.used_centroid_fallback) metrics.centroid_fallback_count += 1
      if (row.warnings.includes('incomplete_zone_coverage')) {
        metrics.incomplete_coverage_count += 1
      }
      metrics.results.push(row)
    } catch {
      metrics.events_failed += 1
    }
  })

  metrics.duration_ms = Date.now() - started
  return metrics
}
