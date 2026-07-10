import {
  FIRE_LIFECYCLE_CORRELATION,
  FIRE_LIFECYCLE_WINDOWS,
  haversineDistanceM,
  hoursBetween,
} from '@/modules/lifecycle/config/fire-lifecycle.config'
import type { LifecycleDetectionPoint } from '@/modules/lifecycle/lifecycle.types'

export type CorrelationDecision =
  | 'same_event_continuation'
  | 'same_event_persistence'
  | 'same_event_expansion'
  | 'same_event_reactivation'
  | 'separate_event'

export function classifyDetectionCorrelation(input: {
  existingDetections: LifecycleDetectionPoint[]
  candidateDetection: LifecycleDetectionPoint
  currentLifecycleState: string | null
  evaluatedAt: string
}): {
  decision: CorrelationDecision
  distance_m: number | null
  hours_gap: number | null
  within_continuity_window: boolean
  within_reactivation_window: boolean
} {
  const sorted = [...input.existingDetections].sort((a, b) =>
    a.acquired_at.localeCompare(b.acquired_at),
  )
  if (!sorted.length) {
    return {
      decision: 'separate_event',
      distance_m: null,
      hours_gap: null,
      within_continuity_window: false,
      within_reactivation_window: false,
    }
  }

  const anchor = sorted[sorted.length - 1]
  const distance_m = haversineDistanceM(
    anchor.latitude,
    anchor.longitude,
    input.candidateDetection.latitude,
    input.candidateDetection.longitude,
  )
  const hours_gap = hoursBetween(anchor.acquired_at, input.candidateDetection.acquired_at)
  const within_continuity_window = hours_gap <= FIRE_LIFECYCLE_WINDOWS.continuityHours
  const within_reactivation_window = hours_gap <= FIRE_LIFECYCLE_WINDOWS.reactivationWindowHours

  if (distance_m > FIRE_LIFECYCLE_CORRELATION.minDistanceForSeparateEventM) {
    return {
      decision: 'separate_event',
      distance_m,
      hours_gap,
      within_continuity_window,
      within_reactivation_window,
    }
  }

  if (
    input.currentLifecycleState === 'resolved' &&
    distance_m <= FIRE_LIFECYCLE_CORRELATION.maxDistanceM &&
    within_reactivation_window
  ) {
    return {
      decision: 'same_event_reactivation',
      distance_m,
      hours_gap,
      within_continuity_window,
      within_reactivation_window,
    }
  }

  if (
    distance_m <= FIRE_LIFECYCLE_CORRELATION.maxDistanceM &&
    (within_continuity_window || hours_gap <= FIRE_LIFECYCLE_WINDOWS.activeHours)
  ) {
    const recentCount = sorted.filter(
      (d) =>
        hoursBetween(d.acquired_at, input.evaluatedAt) <=
        FIRE_LIFECYCLE_WINDOWS.persistenceWindowHours,
    ).length
    if (recentCount + 1 >= FIRE_LIFECYCLE_WINDOWS.persistenceMinDetections) {
      return {
        decision: 'same_event_persistence',
        distance_m,
        hours_gap,
        within_continuity_window,
        within_reactivation_window,
      }
    }
    return {
      decision: 'same_event_continuation',
      distance_m,
      hours_gap,
      within_continuity_window,
      within_reactivation_window,
    }
  }

  if (
    distance_m > FIRE_LIFECYCLE_CORRELATION.maxDistanceM &&
    hours_gap <= FIRE_LIFECYCLE_WINDOWS.continuityHours
  ) {
    return {
      decision: 'separate_event',
      distance_m,
      hours_gap,
      within_continuity_window,
      within_reactivation_window,
    }
  }

  return {
    decision: 'same_event_continuation',
    distance_m,
    hours_gap,
    within_continuity_window,
    within_reactivation_window,
  }
}

export function detectionSpreadHa(detections: LifecycleDetectionPoint[]): number | null {
  if (detections.length < 2) return null
  let maxDist = 0
  for (let i = 0; i < detections.length; i += 1) {
    for (let j = i + 1; j < detections.length; j += 1) {
      const d = haversineDistanceM(
        detections[i].latitude,
        detections[i].longitude,
        detections[j].latitude,
        detections[j].longitude,
      )
      if (d > maxDist) maxDist = d
    }
  }
  const areaM2 = Math.PI * (maxDist / 2) ** 2
  return Math.round((areaM2 / 10_000) * 100) / 100
}
