import {
  ACTION_THRESHOLDS,
  ATTENTION_THRESHOLDS,
  VERIFICATION_THRESHOLDS,
} from '@/modules/priorities/config/fire-priority.config'
import {
  FIRE_INCIDENT_PRIORITY,
  FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
} from '@/modules/incidents/config/fire-incident-correlation.config'
import { assertSafeIncidentCopy } from '@/modules/incidents/incidents-copy-guard'
import type {
  IncidentEventSnapshot,
  IncidentEvidenceStatus,
  IncidentPriorityResult,
} from '@/modules/incidents/incidents.types'

function clamp(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score * 100) / 100))
}

function resolveLevel<T extends string>(
  score: number,
  thresholds: Record<T, number>,
  ordered: T[],
): T {
  let level = ordered[0]
  for (const candidate of ordered) {
    if (score >= thresholds[candidate]) level = candidate
  }
  return level
}

function uniqueSourceFamilies(products: string[]): string[] {
  return [...new Set(products.map((p) => p.split('_')[0] ?? p).filter(Boolean))]
}

export function aggregateIncidentPriority(
  members: IncidentEventSnapshot[],
): IncidentPriorityResult {
  const active = members.filter(
    (m) =>
      m.lifecycle_state !== 'invalidated' &&
      m.lifecycle_state !== 'resolved' &&
      m.membership_status !== 'historical',
  )
  const scored = [...members].filter((m) => m.attention_score != null)

  const dominant = scored.sort(
    (a, b) => (b.attention_score ?? 0) - (a.attention_score ?? 0),
  )[0]

  const baseAttention = dominant?.attention_score ?? 0
  const baseVerification = dominant?.verification_score ?? 0
  const baseAction = dominant?.action_score ?? 0

  const allProducts = members.flatMap((m) => m.source_products)
  const sourceFamilies = uniqueSourceFamilies(allProducts)
  const eventCount = members.length
  const activeCount = active.length

  let evidenceStatus: IncidentEvidenceStatus = 'single_source'
  let sourceBonus = 0
  const limitations: string[] = []
  const redundant: string[] = []

  if (eventCount > 1 && sourceFamilies.length <= 1) {
    evidenceStatus = 'multi_event_same_source'
    sourceBonus = FIRE_INCIDENT_PRIORITY.multiEventSameSourceBonus * 100
    limitations.push(
      'Varios eventos térmicos de la misma fuente no equivalen a corroboración independiente',
    )
    const sorted = [...scored].sort(
      (a, b) => (b.attention_score ?? 0) - (a.attention_score ?? 0),
    )
    for (const m of sorted.slice(1)) redundant.push(m.event_id)
  } else if (sourceFamilies.length > 1) {
    evidenceStatus = 'multi_source'
    sourceBonus = FIRE_INCIDENT_PRIORITY.multiSourceBonus * 100
  }

  const redundancyPenalty = Math.min(
    FIRE_INCIDENT_PRIORITY.sameSourceRedundancyCap * 100,
    Math.max(0, eventCount - 1) * 3,
  )

  const activeBonus = Math.min(
    FIRE_INCIDENT_PRIORITY.activeEventCountCap * 100,
    Math.max(0, activeCount - 1) * 4,
  )

  const attention = clamp(baseAttention + sourceBonus * 0.5 + activeBonus - redundancyPenalty)
  const verification = clamp(baseVerification + sourceBonus * 0.3)
  const action = clamp(baseAction + sourceBonus * 0.2 - redundancyPenalty * 0.5)

  const attentionLevel = resolveLevel(attention, ATTENTION_THRESHOLDS, [
    'routine',
    'monitor',
    'review',
    'high_attention',
    'priority_attention',
  ])
  const verificationLevel = resolveLevel(verification, VERIFICATION_THRESHOLDS, [
    'not_required',
    'useful',
    'recommended',
    'high_priority',
  ])
  const actionLevel = resolveLevel(action, ACTION_THRESHOLDS, [
    'none',
    'prepare',
    'coordinate',
    'operational_attention',
  ])

  const explanation = {
    base_event_id: dominant?.event_id ?? null,
    base_attention: baseAttention,
    base_verification: baseVerification,
    base_action: baseAction,
    source_bonus: sourceBonus,
    active_event_bonus: activeBonus,
    redundancy_penalty: redundancyPenalty,
    active_event_count: activeCount,
    event_count: eventCount,
    source_families: sourceFamilies,
    model_version: FIRE_INCIDENT_CORRELATION_MODEL_VERSION,
  }

  const summaryText = JSON.stringify(explanation)
  assertSafeIncidentCopy(summaryText)

  return {
    attention_score: attention,
    verification_score: verification,
    action_score: action,
    attention_level: attentionLevel,
    verification_level: verificationLevel,
    action_level: actionLevel,
    evidence_status: evidenceStatus,
    priority_explanation: explanation,
    priority_limitations: limitations,
    dominant_event_id: dominant?.event_id ?? null,
    redundant_event_ids: redundant,
  }
}
