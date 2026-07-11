/**
 * Environmental Event Framework — thermal detector adapter (server).
 *
 * The clustering that turns detections into events already runs inside the fire
 * pipeline (src/pipeline/engines/fire/cluster.pipeline.ts). This adapter does
 * NOT re-implement clustering; it exposes the already-detected thermal events
 * through the canonical detector contract by reading the current store and
 * converting the result. The physical pipeline keeps operating unchanged.
 */
import type {
  EnvironmentalEventDetector,
  EventDetectionContext,
  DetectedEventResult,
} from '@/modules/environmental-events/contracts/detector'
import type { ThermalObservation } from '@/modules/environmental-events/types/observation.types'
import type { ThermalEnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import { mapFireEventToEnvironmentalEvent } from '@/modules/environmental-events/thermal/thermal-event.mapper'
import type { FireEventsQuery } from '@/modules/fires/api/fire-api.validation'
import { listFireEvents } from '../fire-events.service.js'

export class ThermalEventDetectorAdapter
  implements EnvironmentalEventDetector<ThermalObservation, ThermalEnvironmentalEvent>
{
  readonly eventType = 'thermal_activity' as const

  async detect(
    _observations: ThermalObservation[],
    _context: EventDetectionContext,
  ): Promise<DetectedEventResult<ThermalEnvironmentalEvent>[]> {
    const result = await listFireEvents({ limit: 100, offset: 0 } as FireEventsQuery)
    return result.items.map((row) => ({
      event: mapFireEventToEnvironmentalEvent(row),
      isNew: row.status === 'new',
      contributingObservationIds: [],
    }))
  }

  async update(
    existingEvent: ThermalEnvironmentalEvent,
    _observations: ThermalObservation[],
    _context: EventDetectionContext,
  ): Promise<DetectedEventResult<ThermalEnvironmentalEvent>> {
    return { event: existingEvent, isNew: false, contributingObservationIds: [] }
  }

  shouldClose(event: ThermalEnvironmentalEvent): boolean {
    return event.status === 'resolved' || event.status === 'archived'
  }
}

export const thermalEventDetector = new ThermalEventDetectorAdapter()
