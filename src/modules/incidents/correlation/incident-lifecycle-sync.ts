import { FIRE_INCIDENT_LIFECYCLE } from '@/modules/incidents/config/fire-incident-correlation.config'
import type { IncidentEventSnapshot, IncidentStatus } from '@/modules/incidents/incidents.types'

export function deriveIncidentStatus(
  members: IncidentEventSnapshot[],
  evaluatedAt: string,
): IncidentStatus {
  const active = members.filter(
    (m) =>
      m.membership_status === 'active' &&
      m.lifecycle_state &&
      (FIRE_INCIDENT_LIFECYCLE.activeMemberLifecycleStates as readonly string[]).includes(
        m.lifecycle_state,
      ),
  )

  const allInvalidated = members.every((m) => m.lifecycle_state === 'invalidated')
  if (allInvalidated) return 'invalidated'

  if (active.length > 0) return 'open'

  const hasHistorical = members.some(
    (m) => m.lifecycle_state === 'resolved' || m.lifecycle_state === 'inactive_monitoring',
  )
  if (!hasHistorical) return 'monitoring'

  const lastObserved = members.reduce((max, m) => {
    const t = new Date(m.last_detected_at).getTime()
    return t > max ? t : max
  }, 0)
  const hoursSince =
    (new Date(evaluatedAt).getTime() - lastObserved) / 3_600_000

  if (hoursSince >= FIRE_INCIDENT_LIFECYCLE.resolvedWindowHours) return 'resolved'
  return 'monitoring'
}

export function shouldDeactivateMembership(event: IncidentEventSnapshot): boolean {
  return (
    event.lifecycle_state === 'invalidated' ||
    (event.lifecycle_state === 'resolved' && event.membership_status === 'active')
  )
}
