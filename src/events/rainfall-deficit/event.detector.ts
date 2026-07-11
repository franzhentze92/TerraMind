/**
 * Déficit de precipitación — event detector (CHIRPS v3 pentadal pipeline).
 */
import type {
  DetectedEventResult,
  EnvironmentalEventDetector,
  EventDetectionContext,
} from '@/modules/environmental-events/contracts/detector'
import type { RainfallDeficitObservation } from '@/modules/precipitation/chirps-v3/chirps-v3.observations'
import { runDetectionPipeline } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.pipeline'
import {
  loadRainfallDeficitStore,
  mergeObservationsIdempotent,
  saveRainfallDeficitStore,
  upsertEvents,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.store'
import type { RainfallDeficitEnvironmentalEvent } from './event.types'

export class RainfallDeficitDetector
  implements EnvironmentalEventDetector<RainfallDeficitObservation, RainfallDeficitEnvironmentalEvent>
{
  readonly eventType = 'rainfall_deficit' as const

  async detect(
    observations: RainfallDeficitObservation[],
    context: EventDetectionContext,
  ): Promise<DetectedEventResult<RainfallDeficitEnvironmentalEvent>[]> {
    const store = loadRainfallDeficitStore()
    const mergedObs = mergeObservationsIdempotent(store.observations, observations)
    const endDate = context.now ?? new Date()
    const { events, nextConsecutive } = runDetectionPipeline({
      observations: mergedObs,
      existingEvents: store.events,
      cellConsecutive: store.cellConsecutivePentads,
      endDate,
    })
    const allEvents = upsertEvents(store.events, events)
    saveRainfallDeficitStore({
      ...store,
      observations: mergedObs,
      events: allEvents,
      cellConsecutivePentads: nextConsecutive,
    })
    return events.map((event) => ({
      event,
      isNew: !store.events.some((e) => e.id === event.id),
      contributingObservationIds: observations.map((o) => o.id),
    }))
  }

  async update(
    existingEvent: RainfallDeficitEnvironmentalEvent,
    observations: RainfallDeficitObservation[],
    context: EventDetectionContext,
  ): Promise<DetectedEventResult<RainfallDeficitEnvironmentalEvent>> {
    const results = await this.detect(observations, context)
    const updated = results.find((r) => r.event.id === existingEvent.id)
    if (updated) return updated
    return { event: existingEvent, isNew: false, contributingObservationIds: [] }
  }

  shouldClose(event: RainfallDeficitEnvironmentalEvent, _context: EventDetectionContext): boolean {
    return event.lifecycleState === 'ended' || event.status === 'resolved'
  }
}

export const rainfallDeficitDetector = new RainfallDeficitDetector()
