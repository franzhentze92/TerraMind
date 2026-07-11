/** Thermal activity plugin — report adapter. */
import type { EventReportAdapter } from '@/modules/environmental-events/contracts/report-adapter'
import type { ReportSection } from '@/modules/institutional-reports/institutional-report.types'
import type {
  EnvironmentalEvent,
  ThermalEnvironmentalEvent,
} from '@/modules/environmental-events/types/environmental-event.types'
import { buildThermalReportSection } from '@/modules/environmental-events/reports/thermal-report-section'

export class ThermalReportAdapter implements EventReportAdapter {
  readonly eventType = 'thermal_activity' as const

  buildSection(events: EnvironmentalEvent[]): ReportSection {
    const thermal = events.filter(
      (e): e is ThermalEnvironmentalEvent => e.eventType === 'thermal_activity',
    )
    return buildThermalReportSection(thermal)
  }
}

export const thermalReportAdapter = new ThermalReportAdapter()
