import { CLUSTER_CONFIG } from '@/pipeline/engines/fire/cluster.config'
import type {
  ClusterDetection,
  PriorityComponents,
  RiskLevel,
  ScoredCluster,
  ValidationStatus,
} from '@/pipeline/stores/fire-event.types'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function normalizeSatellite(
  satellite: string | null,
  sourceProduct: string,
): string {
  const s = satellite?.trim()
  return s && s.length > 0 ? s : sourceProduct
}

export function scoreConfidence(
  confidence: ClusterDetection['confidence_normalized'],
): { points: number; missing: boolean } {
  if (!confidence) return { points: 0, missing: true }
  if (confidence === 'alta') return { points: 20, missing: false }
  if (confidence === 'media') return { points: 12, missing: false }
  return { points: 5, missing: false }
}

export function scoreDetections(count: number): number {
  return clamp(count * 5, 0, 20)
}

export function scoreSatellites(count: number): number {
  return clamp(count * 7, 0, 20)
}

export function scorePersistence(hours: number): number {
  if (hours >= 12) return 20
  if (hours >= 6) return 12
  return 5
}

export function scoreFrp(maxFrp: number | null): { points: number; missing: boolean } {
  if (maxFrp === null || !Number.isFinite(maxFrp)) return { points: 0, missing: true }
  if (maxFrp >= 50) return { points: 20, missing: false }
  if (maxFrp >= 20) return { points: 14, missing: false }
  if (maxFrp >= 0) return { points: 8, missing: false }
  return { points: 0, missing: false }
}

/** Precedencia explícita: atencion > observacion > informativo */
export function computeRiskLevel(input: {
  detectionCount: number
  satelliteCount: number
  persistenceHours: number
  hasHighConfidence: boolean
}): RiskLevel {
  const { detectionCount, satelliteCount, persistenceHours, hasHighConfidence } = input

  if (satelliteCount >= 2) return 'atencion'
  if (hasHighConfidence && persistenceHours >= 12) return 'atencion'
  if (detectionCount >= 2 || persistenceHours >= 6) return 'observacion'
  return 'informativo'
}

export function computeValidationStatus(input: {
  detectionCount: number
  satelliteCount: number
}): ValidationStatus {
  if (input.detectionCount >= 2 || input.satelliteCount >= 2) return 'probable'
  return 'no_validado'
}

export function computeTemporalStatus(input: {
  lastDetectedAt: string
  isNewThisRun: boolean
  now?: Date
}): 'new' | 'active' | 'monitoring' | 'closed' {
  if (input.isNewThisRun) return 'new'

  const now = input.now ?? new Date()
  const last = new Date(input.lastDetectedAt)
  const hours = (now.getTime() - last.getTime()) / 3_600_000

  if (hours <= CLUSTER_CONFIG.activeHours) return 'active'
  if (hours <= CLUSTER_CONFIG.monitoringHours) return 'monitoring'
  return 'closed'
}

export function computePriorityScore(components: PriorityComponents): number {
  return clamp(
    components.confidence +
      components.detections +
      components.satellites +
      components.persistence +
      components.frp,
    0,
    100,
  )
}

export function scoreCluster(
  detections: ClusterDetection[],
  isNewThisRun: boolean,
): ScoredCluster {
  const sorted = [...detections].sort(
    (a, b) =>
      new Date(a.acquired_at_utc).getTime() - new Date(b.acquired_at_utc).getTime(),
  )

  const first = sorted[0].acquired_at_utc
  const last = sorted[sorted.length - 1].acquired_at_utc
  const persistenceHours =
    (new Date(last).getTime() - new Date(first).getTime()) / 3_600_000

  const satellites = new Set(detections.map((d) => d.satellite_normalized))
  const sourceProducts = [...new Set(detections.map((d) => d.source_product))].sort()
  const frpValues = detections
    .map((d) => d.frp_mw)
    .filter((v): v is number => v !== null && Number.isFinite(v))
  const maxFrp = frpValues.length ? Math.max(...frpValues) : null

  const confidences = detections.map((d) => scoreConfidence(d.confidence_normalized))
  const maxConfidencePts = Math.max(...confidences.map((c) => c.points))
  const missingConfidence = confidences.some((c) => c.missing)

  const frpScore = scoreFrp(maxFrp)
  const satelliteCount = satellites.size
  const detectionCount = detections.length

  const priority_components: PriorityComponents = {
    confidence: maxConfidencePts,
    detections: scoreDetections(detectionCount),
    satellites: scoreSatellites(satelliteCount),
    persistence: scorePersistence(persistenceHours),
    frp: frpScore.points,
  }

  const departmentIds = [
    ...new Set(
      detections.map((d) => d.department_id).filter((id): id is string => Boolean(id)),
    ),
  ]
  const departmentNames = [
    ...new Set(
      detections
        .map((d) => d.department_name)
        .filter((name): name is string => Boolean(name)),
    ),
  ]

  const hasHighConfidence = detections.some((d) => d.confidence_normalized === 'alta')

  return {
    detection_ids: detections.map((d) => d.id),
    validation_status: computeValidationStatus({ detectionCount, satelliteCount }),
    risk_level: computeRiskLevel({
      detectionCount,
      satelliteCount,
      persistenceHours,
      hasHighConfidence,
    }),
    priority_score: computePriorityScore(priority_components),
    priority_components,
    satellite_count: satelliteCount,
    source_products: sourceProducts,
    max_frp_mw: maxFrp,
    department_id: departmentIds.length === 1 ? departmentIds[0] : null,
    cross_department: departmentIds.length > 1,
    department_ids: departmentIds,
    department_names: departmentNames,
    first_detected_at: first,
    last_detected_at: last,
    persistence_hours: persistenceHours,
    geometry_method:
      detectionCount === 1 ? 'single_detection_buffer' : 'convex_hull_buffer',
    missing_confidence: missingConfidence,
    missing_frp: frpScore.missing,
    status: computeTemporalStatus({ lastDetectedAt: last, isNewThisRun }),
  }
}

/** Distancia Haversine en metros (aproximación para dry-run) */
export function haversineMeters(
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

export function maxInternalDistanceM(detections: ClusterDetection[]): number {
  let max = 0
  for (let i = 0; i < detections.length; i++) {
    for (let j = i + 1; j < detections.length; j++) {
      const d = haversineMeters(
        detections[i].latitude,
        detections[i].longitude,
        detections[j].latitude,
        detections[j].longitude,
      )
      if (d > max) max = d
    }
  }
  return Math.round(max)
}

export function areConnected(
  a: ClusterDetection,
  b: ClusterDetection,
  distanceM: number,
  timeHours: number,
): boolean {
  const dist = haversineMeters(a.latitude, a.longitude, b.latitude, b.longitude)
  const timeDiff =
    Math.abs(new Date(a.acquired_at_utc).getTime() - new Date(b.acquired_at_utc).getTime()) /
    3_600_000
  return dist <= distanceM && timeDiff <= timeHours
}
