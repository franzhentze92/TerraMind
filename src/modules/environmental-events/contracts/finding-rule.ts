/**
 * Environmental Event Framework — finding rule contract.
 *
 * Rules are classified reusable (territory/exposure/persistence) vs type-specific
 * (thermal FRP/satellites). This foundation registers descriptors; it does not
 * migrate the Composite Finding Engine.
 */
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

export type FindingRuleCategory = 'reusable' | 'type_specific'

export interface EnvironmentalContext {
  now?: Date
}

export interface FindingRuleResult {
  ruleId: string
  matched: boolean
  title: string
  rationale: string
}

export interface EnvironmentalFindingRule<
  TEvent extends EnvironmentalEvent = EnvironmentalEvent,
> {
  id: string
  category: FindingRuleCategory
  supportedEventTypes: EnvironmentalEventType[]

  evaluate(
    event: TEvent,
    context: EnvironmentalContext,
  ): Promise<FindingRuleResult | null>
}
