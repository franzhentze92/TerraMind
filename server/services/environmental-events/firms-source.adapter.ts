/**
 * Environmental Event Framework — FIRMS observation source adapter (server).
 *
 * Wraps the EXISTING thermal read path. It does not re-implement ingestion and
 * does not touch the scheduler; `fetch` reads already-ingested detections and
 * `getHealth` reuses the existing summary + pipeline health services.
 */
import type {
  ObservationSourceAdapter,
  ObservationFetchRequest,
  ObservationNormalizationContext,
  ObservationSourceHealth,
} from '@/modules/environmental-events/types/observation.types'
import type { ThermalObservation } from '@/modules/environmental-events/types/observation.types'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { FireDetectionGeoJsonFeature } from '@/modules/fires/types/fire.dto'
import type { FireEventsQuery } from '@/modules/fires/api/fire-api.validation'
import {
  mapDetectionToThermalObservation,
  FIRMS_SOURCE_ADAPTER_ID,
} from '@/modules/environmental-events/thermal/thermal-event.mapper'
import { FIRE_SOURCES_EXPECTED } from '@/modules/fires/config/fire.constants'
import { getFireDetectionsGeoJson } from '../fire-geojson.service.js'
import { getFireSummary } from '../fire-summary.service.js'
import { getFirePipelineHealth } from '../fire-pipeline-health.service.js'

export class FirmsObservationSourceAdapter
  implements ObservationSourceAdapter<FireDetectionGeoJsonFeature, ThermalObservation>
{
  readonly id = FIRMS_SOURCE_ADAPTER_ID
  readonly label = 'NASA FIRMS'
  readonly supportedEventTypes: EnvironmentalEventType[] = ['thermal_activity']

  async fetch(request: ObservationFetchRequest): Promise<FireDetectionGeoJsonFeature[]> {
    if (request.dryRun) return []
    const query = {
      since: request.since,
      until: request.until,
      offset: 0,
      limit: 100,
    } as FireEventsQuery
    const result = await getFireDetectionsGeoJson(query)
    return result.features
  }

  async normalize(
    raw: FireDetectionGeoJsonFeature[],
    _context: ObservationNormalizationContext,
  ): Promise<ThermalObservation[]> {
    return raw.map((feature) =>
      mapDetectionToThermalObservation(
        feature.properties,
        feature.geometry.coordinates as [number, number],
      ),
    )
  }

  async getHealth(): Promise<ObservationSourceHealth> {
    const [summary, pipeline] = await Promise.all([
      getFireSummary(48).catch(() => null),
      getFirePipelineHealth().catch(() => null),
    ])
    const status = summary?.data_status
    return {
      id: this.id,
      label: this.label,
      healthy: pipeline ? pipeline.is_healthy && !pipeline.is_stale : false,
      lastSuccessAt: status?.last_successful_ingestion_at ?? pipeline?.last_success_at ?? null,
      providersExpected: status?.sources_expected ?? FIRE_SOURCES_EXPECTED,
      providersOperational: status?.sources_queried_successfully ?? 0,
      detail: status?.failed_source_names?.length
        ? `Proveedores con fallo: ${status.failed_source_names.join(', ')}`
        : undefined,
    }
  }
}

export const firmsObservationSourceAdapter = new FirmsObservationSourceAdapter()
