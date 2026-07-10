import { PRIMARY_EVENT_WEIGHTS } from '@/modules/incidents/config/fire-incident-correlation.config'
import type { IncidentEventSnapshot, PrimaryEventSelection } from '@/modules/incidents/incidents.types'

const LIFECYCLE_RANK: Record<string, number> = {
  expanding: 1,
  persistent: 0.9,
  reactivated: 0.85,
  active: 0.8,
  declining: 0.6,
  inactive_monitoring: 0.4,
  detected: 0.3,
  resolved: 0.1,
  invalidated: 0,
}

function recencyScore(lastDetectedAt: string, evaluatedAt: string): number {
  const hours =
    (new Date(evaluatedAt).getTime() - new Date(lastDetectedAt).getTime()) / 3_600_000
  if (hours <= 6) return 1
  if (hours <= 24) return 0.8
  if (hours <= 48) return 0.5
  return 0.2
}

export function selectPrimaryEvent(
  members: IncidentEventSnapshot[],
  evaluatedAt: string,
): PrimaryEventSelection | null {
  const active = members.filter(
    (m) => m.lifecycle_state !== 'invalidated' && m.lifecycle_state !== 'resolved',
  )
  const pool = active.length ? active : members
  if (!pool.length) return null

  const centroidLat =
    pool.reduce((s, m) => s + (m.centroid_lat ?? 0), 0) / pool.length
  const centroidLng =
    pool.reduce((s, m) => s + (m.centroid_lng ?? 0), 0) / pool.length

  let best = pool[0]
  let bestScore = -1
  let bestReason = ''

  for (const member of pool) {
    const lifecycle = LIFECYCLE_RANK[member.lifecycle_state ?? 'detected'] ?? 0.3
    const recency = recencyScore(member.last_detected_at, evaluatedAt)
    const priority = (member.attention_score ?? 0) / 100
    const persistence = Math.min(1, (member.persistence_hours ?? 0) / 24)
    let centrality = 0.5
    if (member.centroid_lat != null && member.centroid_lng != null) {
      const dLat = Math.abs(member.centroid_lat - centroidLat)
      const dLng = Math.abs(member.centroid_lng - centroidLng)
      centrality = Math.max(0, 1 - (dLat + dLng) * 10)
    }

    const score =
      lifecycle * PRIMARY_EVENT_WEIGHTS.lifecycle +
      recency * PRIMARY_EVENT_WEIGHTS.recency +
      priority * PRIMARY_EVENT_WEIGHTS.priority +
      persistence * PRIMARY_EVENT_WEIGHTS.persistence +
      centrality * PRIMARY_EVENT_WEIGHTS.spatial_centrality

    if (score > bestScore) {
      bestScore = score
      best = member
      bestReason = `lifecycle=${member.lifecycle_state}; recencia; prioridad=${member.attention_score ?? 0}; persistencia=${member.persistence_hours ?? 0}h`
    }
  }

  return {
    event_id: best.event_id,
    event_type: best.event_type,
    selection_reason: bestReason,
    selection_rule: 'INCIDENT_PRIMARY_SELECTION_001',
    score: Math.round(bestScore * 1000) / 1000,
  }
}
