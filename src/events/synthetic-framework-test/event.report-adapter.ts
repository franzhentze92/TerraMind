/** Synthetic framework test plugin — report adapter. */
import type { EventReportAdapter } from '@/modules/environmental-events/contracts/report-adapter'
import type { ReportSection } from '@/modules/institutional-reports/institutional-report.types'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import type { SyntheticEnvironmentalEvent } from './event.types'

export class SyntheticReportAdapter implements EventReportAdapter {
  readonly eventType = 'synthetic_framework_test' as const

  buildSection(events: EnvironmentalEvent[]): ReportSection {
    const synthetic = events.filter(
      (e): e is SyntheticEnvironmentalEvent => e.eventType === 'synthetic_framework_test',
    )
    return {
      id: 'synthetic_framework_test',
      title: 'Evento sintético (prueba)',
      content:
        synthetic.length === 0
          ? 'Sin eventos sintéticos.'
          : `${synthetic.length} evento(s) sintético(s) de prueba.`,
      items: synthetic.slice(0, 5).map((e) => `Sintético #${e.attributes.syntheticIndex}`),
      status: 'demo',
    }
  }
}

export const syntheticReportAdapter = new SyntheticReportAdapter()
