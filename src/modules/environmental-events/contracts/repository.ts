/**
 * Environmental Event Framework — read repository contract.
 *
 * A repository resolves canonical events + relations from whatever underlying
 * store a type uses. The thermal adapter reads existing `fire_*` stores; no
 * universal table is introduced.
 */
import type {
  EnvironmentalEvent,
  EnvironmentalEventPage,
  EnvironmentalEventQuery,
} from '@/modules/environmental-events/types/environmental-event.types'

export interface RelatedFindingRef {
  id: string
  title: string
  status: string
  severityLabel?: string
}

export interface RelatedPriorityRef {
  id: string | null
  attentionScore: number | null
  attentionLevel: string | null
}

export interface RelatedIncidentRef {
  id: string | null
  status: string | null
}

export interface EventTypeSummarySnapshot {
  activeCount: number
  newCount?: number
  status?: string
}

export interface EnvironmentalEventRepository {
  list(query: EnvironmentalEventQuery): Promise<EnvironmentalEventPage>
  getById(id: string): Promise<EnvironmentalEvent | null>
  getRelatedFindings(id: string): Promise<RelatedFindingRef[]>
  getRelatedPriority(id: string): Promise<RelatedPriorityRef>
  getRelatedIncident(id: string): Promise<RelatedIncidentRef>
  /**
   * Optional per-type snapshot for Situación Nacional. Plugins that expose it
   * feed the national summary without any central edit.
   */
  summarize?(windowHours: number): Promise<EventTypeSummarySnapshot>
}
