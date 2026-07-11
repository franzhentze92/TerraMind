/** Déficit de precipitación — source descriptors. */
import type { ObservationSourceDescriptor } from '@/modules/environmental-events/types/observation.types'
import {
  CHIRPS_V3_FINAL_ADAPTER_ID,
  CHIRPS_V3_PRELIMINARY_ADAPTER_ID,
} from '@/modules/precipitation/chirps-v3/chirps-v3.observations'
import { CHIRPS_V3_CITATION } from '@/modules/precipitation/chirps-v3/chirps-v3.config'

export const rainfallDeficitSourceDescriptors: ObservationSourceDescriptor[] = [
  {
    id: CHIRPS_V3_PRELIMINARY_ADAPTER_ID,
    label: 'CHIRPS v3 Preliminary (pentad)',
    supportedEventTypes: ['rainfall_deficit'],
    providerNames: ['Climate Hazards Center — CHIRPS v3'],
  },
  {
    id: CHIRPS_V3_FINAL_ADAPTER_ID,
    label: 'CHIRPS v3 Final (pentad)',
    supportedEventTypes: ['rainfall_deficit'],
    providerNames: ['Climate Hazards Center — CHIRPS v3', CHIRPS_V3_CITATION],
  },
]
