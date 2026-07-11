/** Synthetic framework test plugin — type-specific finding rules. */
import type { EnvironmentalFindingRule } from '@/modules/environmental-events/contracts/finding-rule'
import type { SyntheticEnvironmentalEvent } from './event.types'

export const SYNTHETIC_RULE_ID = 'SYNTHETIC_INDEX_POSITIVE'

export const syntheticSpecificFindingRules: EnvironmentalFindingRule<SyntheticEnvironmentalEvent>[] =
  [
    {
      id: SYNTHETIC_RULE_ID,
      category: 'type_specific',
      supportedEventTypes: ['synthetic_framework_test'],
      async evaluate(event) {
        const matched = event.attributes.syntheticIndex > 0
        return {
          ruleId: SYNTHETIC_RULE_ID,
          matched,
          title: 'Índice sintético positivo',
          rationale: matched
            ? `Índice ${event.attributes.syntheticIndex} > 0.`
            : 'Índice no positivo.',
        }
      },
    },
  ]
