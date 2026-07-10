import { genericIncidentCorrelationEngine } from '@/modules/incidents/engine/generic-incident-correlation.engine'
import { aggregateIncidentPriority } from '@/modules/incidents/correlation/incident-priority.engine'
import { selectPrimaryEvent } from '@/modules/incidents/correlation/incident-primary-selection'
import {
  deriveIncidentStatus,
  shouldDeactivateMembership,
} from '@/modules/incidents/correlation/incident-lifecycle-sync'
import {
  loadFireEventIncidentSnapshot,
  listCandidateIncidentSnapshots,
  listPeerFireEventSnapshots,
  loadIncidentMemberSnapshots,
} from '@/modules/incidents/services/fire-incident-snapshot.loader'
import type { CorrelationEvaluationResult } from '@/modules/incidents/incidents.types'
import {
  createIncident,
  updateIncidentAggregates,
} from '@/pipeline/stores/incidents.store'
import {
  getActiveMembershipForEvent,
  insertMembership,
  listMembershipsForIncident,
  recordMembershipHistory,
  updateMembershipStatus,
} from '@/pipeline/stores/incident-memberships.store'
import {
  hasCorrelationSignature,
  insertCorrelationEvaluationRun,
} from '@/pipeline/stores/incident-correlation-runs.store'

async function refreshIncident(incidentId: string, evaluatedAt: string): Promise<void> {
  const members = await loadIncidentMemberSnapshots(incidentId)
  const primary = selectPrimaryEvent(members, evaluatedAt)
  if (!primary) return
  const priority = aggregateIncidentPriority(members)
  const status = deriveIncidentStatus(members, evaluatedAt)
  await updateIncidentAggregates(incidentId, {
    status,
    primary,
    members: members.map((m) => ({
      first_detected_at: m.first_detected_at,
      last_detected_at: m.last_detected_at,
      source_products: m.source_products,
    })),
    priority,
    resolvedAt: status === 'resolved' ? evaluatedAt : null,
  })

  const memberships = await listMembershipsForIncident(incidentId)
  const primaryMembership = memberships.find((m) => m.event_id === primary.event_id)
  if (primaryMembership && primaryMembership.membership_role !== 'primary') {
    for (const m of memberships) {
      if (m.membership_role === 'primary' && m.id !== primaryMembership.id) {
        await updateMembershipStatus({
          membershipId: m.id,
          incidentId,
          eventType: m.event_type,
          eventId: m.event_id,
          status: m.membership_status,
          role: 'supporting',
          reasons: ['Cambio de evento principal'],
        })
      }
    }
    await updateMembershipStatus({
      membershipId: primaryMembership.id,
      incidentId,
      eventType: primaryMembership.event_type,
      eventId: primaryMembership.event_id,
      status: 'active',
      role: 'primary',
      reasons: [primary.selection_reason],
    })
    await recordMembershipHistory({
      incidentId,
      eventType: primary.event_type,
      eventId: primary.event_id,
      action: 'primary_changed',
      newRole: 'primary',
      correlationReasons: [primary.selection_reason],
      evidenceSnapshot: { rule: primary.selection_rule },
    })
  }
}

export async function runIncidentCorrelationForEvent(
  eventId: string,
): Promise<CorrelationEvaluationResult | null> {
  const evaluatedAt = new Date().toISOString()
  const event = await loadFireEventIncidentSnapshot(eventId)
  if (!event) return null

  const peerEvents = (await listPeerFireEventSnapshots(eventId)).filter(
    (p) => !p.active_incident_id,
  )
  const candidateIncidents = await listCandidateIncidentSnapshots(event.active_incident_id ?? undefined)

  const evaluation = genericIncidentCorrelationEngine.evaluate({
    event,
    peerEvents,
    candidateIncidents,
    evaluatedAt,
  })

  const duplicate = await hasCorrelationSignature(
    event.event_type,
    event.event_id,
    evaluation.context_signature,
  )
  const existingMembership = await getActiveMembershipForEvent(event.event_type, event.event_id)
  const mustApplyEffects =
    (evaluation.correlation_decision === 'create_new_incident' && !existingMembership) ||
    (evaluation.correlation_decision === 'attach_to_existing' &&
      evaluation.target_incident_id &&
      !existingMembership)

  if (duplicate && !mustApplyEffects) {
    await insertCorrelationEvaluationRun({
      evaluation,
      incidentId: event.active_incident_id,
      membershipId: null,
      warnings: ['duplicate_context_signature'],
    })
    return evaluation
  }

  let incidentId: string | null = event.active_incident_id
  let membershipId: string | null = null
  const warnings: string[] = [...evaluation.warnings]

  if (evaluation.correlation_decision === 'no_action' || evaluation.correlation_decision === 'keep_separate') {
    await insertCorrelationEvaluationRun({ evaluation, incidentId, membershipId, warnings })
    return evaluation
  }

  if (evaluation.correlation_decision === 'manual_review_recommended') {
    await insertCorrelationEvaluationRun({ evaluation, incidentId, membershipId, warnings })
    return evaluation
  }

  if (evaluation.correlation_decision === 'create_new_incident') {
    const priority = aggregateIncidentPriority([event])
    incidentId = await createIncident({
      eventId: event.event_id,
      eventType: event.event_type,
      firstObservedAt: event.first_detected_at,
      lastObservedAt: event.last_detected_at,
      centroidLat: event.centroid_lat,
      centroidLng: event.centroid_lng,
      sourceTypes: event.source_products.map((p) => p.split('_')[0] ?? p),
      priority,
      correlationSummary: {
        decision: evaluation.correlation_decision,
        reasons: evaluation.correlation_reasons,
      },
    })
    membershipId = await insertMembership({
      incidentId,
      eventType: event.event_type,
      eventId: event.event_id,
      role: 'primary',
      correlationScore: evaluation.scores.correlation_score,
      correlationReasons: evaluation.correlation_reasons,
    })
  } else if (
    evaluation.correlation_decision === 'attach_to_existing' &&
    (evaluation.target_incident_id || incidentId)
  ) {
    incidentId = evaluation.target_incident_id ?? incidentId
    if (!incidentId) {
      warnings.push('attach_without_target_incident')
    } else if (!existingMembership) {
      membershipId = await insertMembership({
        incidentId,
        eventType: event.event_type,
        eventId: event.event_id,
        role: 'supporting',
        correlationScore: evaluation.scores.correlation_score,
        correlationReasons: evaluation.correlation_reasons,
      })
    } else {
      membershipId = existingMembership.id
      if (shouldDeactivateMembership(event)) {
        await updateMembershipStatus({
          membershipId: existingMembership.id,
          incidentId,
          eventType: event.event_type,
          eventId: event.event_id,
          status: event.lifecycle_state === 'invalidated' ? 'removed' : 'historical',
          role: 'historical',
          reasons: evaluation.correlation_reasons,
        })
      }
    }
    if (incidentId) await refreshIncident(incidentId, evaluatedAt)
  }

  await insertCorrelationEvaluationRun({
    evaluation: { ...evaluation, target_incident_id: incidentId },
    incidentId,
    membershipId,
    warnings,
  })

  return evaluation
}
