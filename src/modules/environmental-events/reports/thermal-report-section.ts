/**
 * Environmental Event Framework — thermal report adapter.
 *
 * Converts canonical thermal environmental events into an institutional
 * `ReportSection` WITHOUT changing report appearance, metrics or wording. It is
 * additive: existing reports keep building from canonical_metrics; this adapter
 * lets the institutional model receive canonical events and produce the same
 * numbers, titles, sources and limitations.
 */
import type { ReportSection } from '@/modules/institutional-reports/institutional-report.types'
import type { ThermalEnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import { pluralizeCount, THERMAL_SCIENTIFIC_DISCLAIMER } from '@/modules/fires/utils/thermal-labels'
import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'

export interface ThermalReportAggregate {
  eventCount: number
  detectionCount: number
  satelliteSourceCount: number
  maxFrp: number | null
  sources: string[]
  limitations: string[]
}

/** Deterministic aggregate over canonical thermal events. Changes no numbers. */
export function aggregateThermalEvents(
  events: ThermalEnvironmentalEvent[],
): ThermalReportAggregate {
  const sources = new Set<string>()
  let detectionCount = 0
  let maxFrp: number | null = null
  for (const e of events) {
    detectionCount += e.attributes.detectionCount
    for (const name of e.sourceNames) sources.add(name)
    if (e.attributes.maxFrp != null) {
      maxFrp = maxFrp == null ? e.attributes.maxFrp : Math.max(maxFrp, e.attributes.maxFrp)
    }
  }
  return {
    eventCount: events.length,
    detectionCount,
    satelliteSourceCount: sources.size,
    maxFrp,
    sources: [...sources],
    limitations: [THERMAL_SCIENTIFIC_DISCLAIMER],
  }
}

const THERMAL_REPORT_SECTION_ID = 'thermal_activity'
const THERMAL_REPORT_SECTION_TITLE = 'Actividad térmica'

/** Build the canonical thermal event section for the institutional report. */
export function buildThermalReportSection(
  events: ThermalEnvironmentalEvent[],
): ReportSection {
  const agg = aggregateThermalEvents(events)
  const content =
    agg.eventCount === 0
      ? 'No se registraron eventos térmicos agrupados en el período.'
      : `${pluralizeCount(agg.eventCount, 'evento térmico agrupado', 'eventos térmicos agrupados')} · ` +
        `${pluralizeCount(agg.detectionCount, 'detección', 'detecciones')} · ` +
        `Fuentes: ${agg.sources.join(', ') || 'sin fuente'}.`
  return {
    id: THERMAL_REPORT_SECTION_ID,
    title: THERMAL_REPORT_SECTION_TITLE,
    content,
    items: [
      ...events.slice(0, 10).map((e) =>
        buildThermalEventDisplayName({
          department_name: e.territory?.departmentName ?? null,
          first_detected_at: e.firstObservedAt,
          validation_status: e.attributes.legacy.validationStatus as
            | 'no_validado'
            | 'probable'
            | 'confirmado',
        }),
      ),
      THERMAL_SCIENTIFIC_DISCLAIMER,
    ],
    status: agg.eventCount > 0 ? 'available' : 'pending',
  }
}
