/** Synthetic framework test plugin — presentation adapter. */
import type { EnvironmentalEventPresentationAdapter } from '@/modules/environmental-events/contracts/presentation'
import type { EventKeyMetric } from '@/modules/environmental-events/types/environmental-event.types'
import type { SyntheticEnvironmentalEvent } from './event.types'

export class SyntheticPresentationAdapter
  implements EnvironmentalEventPresentationAdapter<SyntheticEnvironmentalEvent>
{
  readonly eventType = 'synthetic_framework_test' as const

  getDisplayName(event: SyntheticEnvironmentalEvent): string {
    return `Evento sintético #${event.attributes.syntheticIndex}`
  }

  getSummary(event: SyntheticEnvironmentalEvent): string {
    return event.summary ?? event.attributes.note
  }

  getStatusLabel(): string {
    return 'Prueba'
  }

  getLifecycleLabel(): string {
    return 'Prueba'
  }

  getSeverityLabel(): string {
    return 'No aplica'
  }

  getConfidenceLabel(): string {
    return 'No aplica'
  }

  getLimitations(): string[] {
    return ['Evento de prueba; sin validez científica.']
  }

  getKeyMetrics(event: SyntheticEnvironmentalEvent): EventKeyMetric[] {
    return [
      {
        key: 'synthetic_index',
        label: 'Índice sintético',
        value: String(event.attributes.syntheticIndex),
      },
    ]
  }
}

export const syntheticPresentationAdapter = new SyntheticPresentationAdapter()
