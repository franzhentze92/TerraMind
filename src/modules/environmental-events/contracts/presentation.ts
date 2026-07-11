/**
 * Environmental Event Framework — presentation contract.
 *
 * All copy is Spanish and reuses existing per-type label utilities. No
 * duplicated translations.
 */
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type {
  EnvironmentalEvent,
  EventKeyMetric,
} from '@/modules/environmental-events/types/environmental-event.types'

export interface EnvironmentalEventPresentationAdapter<
  TEvent extends EnvironmentalEvent = EnvironmentalEvent,
> {
  eventType: EnvironmentalEventType

  getDisplayName(event: TEvent): string
  getSummary(event: TEvent): string
  getStatusLabel(event: TEvent): string
  getLifecycleLabel(event: TEvent): string
  getSeverityLabel(event: TEvent): string
  getConfidenceLabel(event: TEvent): string
  getLimitations(event: TEvent): string[]
  getKeyMetrics(event: TEvent): EventKeyMetric[]
}
