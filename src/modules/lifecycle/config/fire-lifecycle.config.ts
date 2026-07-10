import type { FireLifecycleState } from '@/modules/lifecycle/lifecycle.types'

export const FIRE_LIFECYCLE_MODEL_VERSION = '1.0.0'

/** Ventanas temporales (horas) — única fuente de thresholds para fire lifecycle */
export const FIRE_LIFECYCLE_WINDOWS = {
  activeHours: 12,
  persistenceWindowHours: 24,
  persistenceMinDetections: 3,
  inactiveMonitoringHours: 48,
  resolvedHours: 72,
  reactivationWindowHours: 168,
  continuityHours: 12,
} as const

/** Correlación espacial (metros) */
export const FIRE_LIFECYCLE_CORRELATION = {
  maxDistanceM: 1500,
  minDistanceForSeparateEventM: 3000,
  expansionAreaGrowthPct: 25,
  expansionDetectionGrowthPct: 40,
  decliningRecentDetectionDropPct: 35,
} as const

export const FIRE_LIFECYCLE_ALLOWED_TRANSITIONS: Array<{
  from: FireLifecycleState
  to: FireLifecycleState
}> = [
  { from: 'detected', to: 'active' },
  { from: 'detected', to: 'inactive_monitoring' },
  { from: 'detected', to: 'invalidated' },
  { from: 'active', to: 'persistent' },
  { from: 'active', to: 'expanding' },
  { from: 'active', to: 'declining' },
  { from: 'active', to: 'inactive_monitoring' },
  { from: 'active', to: 'invalidated' },
  { from: 'persistent', to: 'expanding' },
  { from: 'persistent', to: 'declining' },
  { from: 'persistent', to: 'active' },
  { from: 'persistent', to: 'inactive_monitoring' },
  { from: 'expanding', to: 'declining' },
  { from: 'expanding', to: 'persistent' },
  { from: 'expanding', to: 'active' },
  { from: 'expanding', to: 'inactive_monitoring' },
  { from: 'declining', to: 'inactive_monitoring' },
  { from: 'declining', to: 'active' },
  { from: 'declining', to: 'persistent' },
  { from: 'inactive_monitoring', to: 'active' },
  { from: 'inactive_monitoring', to: 'declining' },
  { from: 'inactive_monitoring', to: 'resolved' },
  { from: 'resolved', to: 'reactivated' },
  { from: 'reactivated', to: 'active' },
  { from: 'reactivated', to: 'persistent' },
  { from: 'reactivated', to: 'expanding' },
  { from: 'reactivated', to: 'declining' },
  { from: 'reactivated', to: 'inactive_monitoring' },
]

export const FIRE_LIFECYCLE_TERMINAL_STATES: FireLifecycleState[] = ['resolved', 'invalidated']

export function hoursBetween(isoA: string, isoB: string): number {
  return Math.abs(new Date(isoB).getTime() - new Date(isoA).getTime()) / 3_600_000
}

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
