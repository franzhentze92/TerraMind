/**
 * Environmental Event Framework — thermal repository adapter (server).
 *
 * Implements the generic EnvironmentalEventRepository by reading the EXISTING
 * `fire_*` stores through the current thermal services. No new universal table,
 * no destructive migration. Numbers are preserved 1:1.
 *
 *   Generic API → generic repository → thermal adapter → fire_* stores
 */
import type {
  EnvironmentalEvent,
  EnvironmentalEventPage,
  EnvironmentalEventQuery,
} from '@/modules/environmental-events/types/environmental-event.types'
import type {
  EnvironmentalEventRepository,
  EventTypeSummarySnapshot,
  RelatedFindingRef,
  RelatedIncidentRef,
  RelatedPriorityRef,
} from '@/modules/environmental-events/contracts/repository'
import {
  mapFireEventDetailToEnvironmentalEvent,
  mapFireEventToEnvironmentalEvent,
} from '@/modules/environmental-events/thermal/thermal-event.mapper'
import { toFireEventsQuery } from '@/modules/environmental-events/thermal/thermal-query.mapper'
import { listFireEvents } from '../fire-events.service.js'
import { getFireEventDetail } from '../fire-event-detail.service.js'
import { getFindingsForFireEvent } from '../findings.service.js'
import { getPriorityForFireEvent } from '../priorities.service.js'
import { getFireEventIncident } from '../incidents.service.js'
import { getFireSummary } from '../fire-summary.service.js'

export class ThermalEventRepositoryAdapter implements EnvironmentalEventRepository {
  readonly eventType = 'thermal_activity' as const

  async list(query: EnvironmentalEventQuery): Promise<EnvironmentalEventPage> {
    const fireQuery = toFireEventsQuery(query)
    const result = await listFireEvents(fireQuery)
    const items: EnvironmentalEvent[] = result.items.map(mapFireEventToEnvironmentalEvent)
    const limit = result.pagination.limit
    const page = limit > 0 ? Math.floor(result.pagination.offset / limit) + 1 : 1
    return {
      items,
      pagination: { page, limit, total: result.pagination.total },
      generatedAt: result.generated_at,
    }
  }

  async getById(id: string): Promise<EnvironmentalEvent | null> {
    const detail = await getFireEventDetail(id)
    if (!detail) return null
    const event = mapFireEventDetailToEnvironmentalEvent(detail)
    const priority = await this.getRelatedPriority(id)
    const incident = await this.getRelatedIncident(id)
    const findings = await this.getRelatedFindings(id)
    return {
      ...event,
      priorityAssessmentId: priority.id ?? undefined,
      incidentId: incident.id ?? undefined,
      findingIds: findings.map((f) => f.id),
    }
  }

  async getRelatedFindings(id: string): Promise<RelatedFindingRef[]> {
    const { items } = await getFindingsForFireEvent(id)
    return items.map((f) => ({
      id: f.id,
      title: f.title,
      status: f.status,
      severityLabel: f.severity_label,
    }))
  }

  async getRelatedPriority(id: string): Promise<RelatedPriorityRef> {
    const { assessment } = await getPriorityForFireEvent(id)
    if (!assessment) return { id: null, attentionScore: null, attentionLevel: null }
    return {
      id: assessment.id,
      attentionScore: assessment.attention_score,
      attentionLevel: assessment.attention_level,
    }
  }

  async getRelatedIncident(id: string): Promise<RelatedIncidentRef> {
    const result = await getFireEventIncident(id)
    if (!result) return { id: null, status: null }
    return { id: result.incident.id, status: result.incident.status }
  }

  async summarize(windowHours: number): Promise<EventTypeSummarySnapshot> {
    const fire = await getFireSummary(windowHours)
    return {
      activeCount: fire.events_count,
      newCount: fire.active_events_count,
      status: fire.data_status.is_stale ? 'delayed' : 'current',
    }
  }
}

export const thermalEventRepository = new ThermalEventRepositoryAdapter()
