/**
 * Environmental Event Framework — priority factor provider contract.
 *
 * Providers surface QUALITATIVE factor contributions for an event. They never
 * recompute the canonical priority score — that stays in the Finding Priority
 * Engine and is served unchanged through the priority API.
 */
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

export type PriorityFactorDomain =
  | 'severity'
  | 'exposure'
  | 'persistence'
  | 'sensitivity'
  | 'uncertainty'
  | 'urgency'

export interface PriorityFactorContribution {
  domain: PriorityFactorDomain
  label: string
  direction: 'increases' | 'decreases' | 'neutral'
  rationale: string
}

export interface PriorityContext {
  now?: Date
}

export interface EventPriorityFactorProvider<
  TEvent extends EnvironmentalEvent = EnvironmentalEvent,
> {
  eventType: EnvironmentalEventType

  getSeverityFactors(event: TEvent, context: PriorityContext): PriorityFactorContribution[]
  getExposureFactors(event: TEvent, context: PriorityContext): PriorityFactorContribution[]
  getPersistenceFactors(event: TEvent, context: PriorityContext): PriorityFactorContribution[]
  getSensitivityFactors(event: TEvent, context: PriorityContext): PriorityFactorContribution[]
  getUncertaintyFactors(event: TEvent, context: PriorityContext): PriorityFactorContribution[]
  getUrgencyFactors(event: TEvent, context: PriorityContext): PriorityFactorContribution[]
}
