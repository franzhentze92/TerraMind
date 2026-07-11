/**
 * Environmental Event Framework — generic UI builders from the manifest.
 *
 * These pure builders let National Situation, maps, cards, detail panels and
 * reports render ANY registered event type without per-type branches. A plugin
 * contributes only its manifest (labels, icon, adapters, sections); the UI is
 * generated here.
 */
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import type {
  EnvironmentalEvent,
  EnvironmentalEventTypeSummary,
  EventKeyMetric,
} from '@/modules/environmental-events/types/environmental-event.types'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type {
  EventLegendDefinition,
  EventMapPopupModel,
} from '@/modules/environmental-events/contracts/map-renderer'
import type { ReportSection } from '@/modules/institutional-reports/institutional-report.types'

export interface EventTypeCatalogEntry {
  type: EnvironmentalEventType
  label: string
  pluralLabel: string
  icon: string
}

export function getEventTypeLabel(type: EnvironmentalEventType): string {
  return environmentalEventRegistry.getLabel(type)
}

export function getEventTypeIcon(type: EnvironmentalEventType): string {
  return environmentalEventRegistry.getIcon(type)
}

/** Catalog of enabled types for menus, tabs and legends. */
export function buildEnabledEventTypeCatalog(): EventTypeCatalogEntry[] {
  return environmentalEventRegistry.listEnabled().map((m) => ({
    type: m.type,
    label: m.label,
    pluralLabel: m.pluralLabel,
    icon: m.icon,
  }))
}

export function buildEventLegend(type: EnvironmentalEventType): EventLegendDefinition {
  return environmentalEventRegistry.getMapRenderer(type).getLegendDefinition()
}

export function buildEventPopup(event: EnvironmentalEvent): EventMapPopupModel {
  return environmentalEventRegistry.getMapRenderer(event.eventType).getPopupModel(event)
}

export interface EventCardModel {
  type: EnvironmentalEventType
  icon: string
  title: string
  summary: string
  statusLabel: string
  severityLabel: string
  metrics: EventKeyMetric[]
}

export function buildEventCardModel(event: EnvironmentalEvent): EventCardModel {
  const manifest = environmentalEventRegistry.get(event.eventType)
  const p = manifest.presentation
  return {
    type: event.eventType,
    icon: manifest.icon,
    title: p.getDisplayName(event),
    summary: p.getSummary(event),
    statusLabel: p.getStatusLabel(event),
    severityLabel: p.getSeverityLabel(event),
    metrics: p.getKeyMetrics(event),
  }
}

export interface EventDetailModel extends EventCardModel {
  lifecycleLabel: string
  confidenceLabel: string
  sections: Array<{ id: string; title: string }>
  methodology: string
  limitations: string[]
}

export function buildEventDetailModel(event: EnvironmentalEvent): EventDetailModel {
  const manifest = environmentalEventRegistry.get(event.eventType)
  const p = manifest.presentation
  return {
    ...buildEventCardModel(event),
    lifecycleLabel: p.getLifecycleLabel(event),
    confidenceLabel: p.getConfidenceLabel(event),
    sections: manifest.detailSections,
    methodology: manifest.methodology,
    limitations: p.getLimitations(event),
  }
}

/** Report section for a type built through its manifest report adapter. */
export function buildEventReportSection(
  type: EnvironmentalEventType,
  events: EnvironmentalEvent[],
): ReportSection {
  return environmentalEventRegistry.getReportAdapter(type).buildSection(events)
}

/** One-line summary for Situación Nacional (label + count). */
export function buildEventTypeSummaryLine(summary: EnvironmentalEventTypeSummary): string {
  const plural = environmentalEventRegistry.tryGet(summary.type)?.pluralLabel ?? summary.label
  return `${summary.label}: ${summary.activeCount} (${plural.toLowerCase()})`
}
