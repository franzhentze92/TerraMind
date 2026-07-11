/**
 * Environmental Event Framework — event detector contract.
 *
 * A detector groups observations into events. Concrete adapters must reuse the
 * existing detection/clustering logic and only convert to the canonical model.
 */
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { BaseEnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import type { EnvironmentalObservation } from '@/modules/environmental-events/types/observation.types'

export interface EventDetectionContext {
  now?: Date
  windowHours?: number
}

export interface DetectedEventResult<
  TEvent extends BaseEnvironmentalEvent<EnvironmentalEventType, unknown>,
> {
  event: TEvent
  isNew: boolean
  contributingObservationIds: string[]
}

export interface EnvironmentalEventDetector<
  TObservation extends EnvironmentalObservation<EnvironmentalEventType, unknown>,
  TEvent extends BaseEnvironmentalEvent<EnvironmentalEventType, unknown>,
> {
  eventType: EnvironmentalEventType

  detect(
    observations: TObservation[],
    context: EventDetectionContext,
  ): Promise<DetectedEventResult<TEvent>[]>

  update(
    existingEvent: TEvent,
    observations: TObservation[],
    context: EventDetectionContext,
  ): Promise<DetectedEventResult<TEvent>>

  shouldClose(event: TEvent, context: EventDetectionContext): boolean
}
