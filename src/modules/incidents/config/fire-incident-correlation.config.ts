export const FIRE_INCIDENT_CORRELATION_MODEL_VERSION = '1.0.0'
export const FIRE_INCIDENT_PRIORITY_MODEL_VERSION = '1.0.0'

export const FIRE_INCIDENT_TYPE = 'possible_vegetation_fire_incident'
export const FIRE_INCIDENT_DOMAIN = 'fire'

/** Umbrales espaciales y temporales — única fuente para fire incident correlation */
export const FIRE_INCIDENT_CORRELATION = {
  attachMaxDistanceM: 4000,
  separateMinDistanceM: 4000,
  manualReviewMaxDistanceM: 8000,
  temporalMaxGapHours: 24,
  temporalMinOverlapHours: 6,
  attachMinCorrelationScore: 0.65,
  manualReviewMinCorrelationScore: 0.45,
  mergeMinCorrelationScore: 0.75,
  departmentOnlyPenalty: 0,
} as const

export const FIRE_INCIDENT_ELIGIBILITY = {
  lifecycleStates: ['active', 'persistent', 'expanding', 'reactivated'] as const,
  minAttentionLevels: ['review', 'high_attention', 'priority_attention'] as const,
  minVerificationLevels: ['recommended', 'high_priority'] as const,
  blockedLifecycleStates: ['invalidated'] as const,
  resolvedCannotCreate: true,
} as const

export const FIRE_INCIDENT_LIFECYCLE = {
  monitoringWindowHours: 48,
  resolvedWindowHours: 72,
  activeMemberLifecycleStates: [
    'active',
    'persistent',
    'expanding',
    'reactivated',
    'declining',
    'inactive_monitoring',
  ] as const,
} as const

export const FIRE_INCIDENT_PRIORITY = {
  sameSourceRedundancyCap: 0.15,
  multiEventSameSourceBonus: 0.08,
  multiSourceBonus: 0.2,
  activeEventCountCap: 0.12,
  persistenceBonusCap: 0.1,
  recencyDecayHours: 48,
} as const

export const PRIMARY_EVENT_WEIGHTS = {
  lifecycle: 0.3,
  recency: 0.2,
  priority: 0.25,
  persistence: 0.15,
  spatial_centrality: 0.1,
} as const

export function haversineDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function hoursBetween(isoA: string, isoB: string): number {
  return Math.abs(new Date(isoB).getTime() - new Date(isoA).getTime()) / 3_600_000
}

export function temporalOverlapHours(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): number {
  const start = Math.max(new Date(aStart).getTime(), new Date(bStart).getTime())
  const end = Math.min(new Date(aEnd).getTime(), new Date(bEnd).getTime())
  if (end <= start) return 0
  return (end - start) / 3_600_000
}
