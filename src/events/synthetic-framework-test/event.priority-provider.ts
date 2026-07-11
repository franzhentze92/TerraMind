/** Synthetic framework test plugin — priority factor provider. */
import type {
  EventPriorityFactorProvider,
  PriorityContext,
  PriorityFactorContribution,
} from '@/modules/environmental-events/contracts/priority-provider'
import type { SyntheticEnvironmentalEvent } from './event.types'

export const SYNTHETIC_PRIORITY_PROVIDER_ID = 'synthetic_priority_factors'

export class SyntheticPriorityFactorProvider
  implements EventPriorityFactorProvider<SyntheticEnvironmentalEvent>
{
  readonly eventType = 'synthetic_framework_test' as const

  getSeverityFactors(
    event: SyntheticEnvironmentalEvent,
    _context: PriorityContext,
  ): PriorityFactorContribution[] {
    return [
      {
        domain: 'severity',
        label: 'Índice sintético',
        direction: event.attributes.syntheticIndex > 0 ? 'increases' : 'neutral',
        rationale: 'Factor de prueba derivado del índice sintético.',
      },
    ]
  }

  getExposureFactors(): PriorityFactorContribution[] {
    return []
  }

  getPersistenceFactors(): PriorityFactorContribution[] {
    return []
  }

  getSensitivityFactors(): PriorityFactorContribution[] {
    return []
  }

  getUncertaintyFactors(): PriorityFactorContribution[] {
    return []
  }

  getUrgencyFactors(): PriorityFactorContribution[] {
    return []
  }
}

export const syntheticPriorityFactorProvider = new SyntheticPriorityFactorProvider()
