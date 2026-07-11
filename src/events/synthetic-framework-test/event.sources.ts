/** Synthetic framework test plugin — source descriptor. */
import type { ObservationSourceDescriptor } from '@/modules/environmental-events/types/observation.types'

export const SYNTHETIC_SOURCE_ID = 'synthetic_source'

export const syntheticSourceDescriptor: ObservationSourceDescriptor = {
  id: SYNTHETIC_SOURCE_ID,
  label: 'Fuente sintética',
  supportedEventTypes: ['synthetic_framework_test'],
  providerNames: ['synthetic-provider'],
}
