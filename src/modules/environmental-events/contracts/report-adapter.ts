/**
 * Environmental Event Framework — report adapter contract.
 *
 * Turns canonical events of a given type into an institutional ReportSection
 * without changing report appearance. Registered per type via the manifest so
 * reports never need per-type `if` branches.
 */
import type { ReportSection } from '@/modules/institutional-reports/institutional-report.types'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

export interface EventReportAdapter<TEvent extends EnvironmentalEvent = EnvironmentalEvent> {
  eventType: EnvironmentalEventType
  buildSection(events: TEvent[]): ReportSection
}
