/**
 * Adaptador incendios → LandCoverService genérico.
 * Commit 7A.2-D: enriquecer fire_event_land_cover_context desde detecciones FIRMS.
 *
 * No contiene lógica raster ni taxonomía — delega a src/modules/territory/land-cover/.
 */

import type { LandCoverAnalysisResult } from '@/modules/territory/land-cover/land-cover.types'
import { createLandCoverService } from '@/modules/territory/land-cover/land-cover.service'

export interface FireDetectionPoint {
  id: string
  longitude: number
  latitude: number
}

export interface EnrichFireLandCoverOptions {
  eventId: string
  detections: FireDetectionPoint[]
  centroid?: { longitude: number; latitude: number } | null
  force?: boolean
}

export interface FireLandCoverEnrichmentMetrics {
  events_considered: number
  events_enriched: number
  events_unchanged: number
  events_failed: number
  centroid_fallback_count: number
  incomplete_coverage_count: number
  duration_ms: number
  context_version: string | null
}

/** Stub — implementación en 7A.2-D. */
export async function enrichFireEventLandCover(
  _options: EnrichFireLandCoverOptions,
): Promise<{ metrics: FireLandCoverEnrichmentMetrics; result: LandCoverAnalysisResult | null }> {
  void createLandCoverService
  throw new Error('fire-land-cover.adapter: no implementado — pendiente Commit 7A.2-D')
}
