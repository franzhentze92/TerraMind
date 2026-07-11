/**
 * Environmental Event Framework — FIRMS source descriptor.
 *
 * Bundle-safe descriptor registered in the event registry. The concrete
 * server-side `FirmsObservationSourceAdapter` (which wraps the existing ingest
 * engine) lives under server/services and is used at runtime.
 */
import type { ObservationSourceDescriptor } from '@/modules/environmental-events/types/observation.types'
import { FIRMS_INGEST_SOURCES } from '@/pipeline/connectors/firms.config'
import { sourceProductDisplayName } from '@/modules/fires/utils/source-labels'
import { FIRMS_SOURCE_ADAPTER_ID } from '@/modules/environmental-events/thermal/thermal-event.mapper'

export const firmsSourceDescriptor: ObservationSourceDescriptor = {
  id: FIRMS_SOURCE_ADAPTER_ID,
  label: 'NASA FIRMS',
  supportedEventTypes: ['thermal_activity'],
  providerNames: FIRMS_INGEST_SOURCES.map(sourceProductDisplayName),
}
