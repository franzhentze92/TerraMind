/**
 * Environmental Event Framework — thermal mapper.
 *
 * Converts the existing thermal DTOs (FireEventListItemDto / FireEventDetailDto)
 * into the canonical `ThermalEnvironmentalEvent`. This is the single place where
 * legacy thermal enums map onto canonical taxonomies. It changes NO numbers.
 */
import type {
  FireEventDetailDto,
  FireEventListItemDto,
  FireDetectionGeoJsonProperties,
  FireEventStatus,
  FireValidationStatus,
  FireRiskLevel,
} from '@/modules/fires/types/fire.dto'
import type {
  EnvironmentalEventStatus,
  EpistemicStatus,
} from '@/modules/environmental-events/types/taxonomy'
import type { ThermalEnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import type { ThermalObservation } from '@/modules/environmental-events/types/observation.types'
import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'
import { sourceProductDisplayName } from '@/modules/fires/utils/source-labels'
import { THERMAL_SCIENTIFIC_DISCLAIMER } from '@/modules/fires/utils/thermal-labels'

export const FIRMS_SOURCE_ADAPTER_ID = 'firms'

const STATUS_MAP: Record<FireEventStatus, EnvironmentalEventStatus> = {
  new: 'detected',
  active: 'active',
  monitoring: 'monitoring',
  closed: 'resolved',
}

const RISK_SEVERITY: Record<FireRiskLevel, number> = {
  informativo: 1,
  observacion: 2,
  atencion: 3,
  alto: 4,
  critico: 5,
}

/** Legacy thermal status -> canonical event status. */
export function mapThermalStatus(status: FireEventStatus): EnvironmentalEventStatus {
  return STATUS_MAP[status] ?? 'detected'
}

/** Legacy validation status -> canonical epistemic status. */
export function mapThermalEpistemic(validation: FireValidationStatus): EpistemicStatus {
  return validation === 'confirmado' ? 'verified' : 'inferred'
}

function pointGeometry(lng: number | null, lat: number | null): GeoJSON.Geometry {
  if (lng == null || lat == null) {
    // Geometry is required; flag absence via metadata rather than fake coords.
    return { type: 'Point', coordinates: [0, 0] }
  }
  return { type: 'Point', coordinates: [lng, lat] }
}

/** Map a thermal list item into a canonical thermal environmental event. */
export function mapFireEventToEnvironmentalEvent(
  event: FireEventListItemDto,
): ThermalEnvironmentalEvent {
  const hasGeometry = event.centroid_lat != null && event.centroid_lng != null
  return {
    id: event.id,
    eventType: 'thermal_activity',
    title: buildThermalEventDisplayName(event),
    status: mapThermalStatus(event.status),
    epistemicStatus: mapThermalEpistemic(event.validation_status),
    classification: 'operational',
    geometry: pointGeometry(event.centroid_lng, event.centroid_lat),
    territory: {
      departmentCode: event.department_code,
      departmentName: event.department_name,
      crossDepartment: event.cross_department,
    },
    firstObservedAt: event.first_detected_at,
    lastObservedAt: event.last_detected_at,
    observationCount: event.detection_count,
    severity: RISK_SEVERITY[event.risk_level],
    persistence: event.persistence_hours ?? undefined,
    sourceIds: [...event.source_products],
    sourceNames: event.source_products.map(sourceProductDisplayName),
    attributes: {
      detectionCount: event.detection_count,
      satelliteCount: event.satellite_count,
      maxFrp: event.max_frp_mw ?? undefined,
      persistenceHours: event.persistence_hours ?? undefined,
      sourceProducts: [...event.source_products],
      legacy: {
        status: event.status,
        validationStatus: event.validation_status,
        riskLevel: event.risk_level,
        priorityScore: event.priority_score,
        geometryMethod: event.geometry_method,
      },
    },
    limitations: [THERMAL_SCIENTIFIC_DISCLAIMER],
    metadata: { hasGeometry },
    createdAt: event.created_at,
    updatedAt: event.last_detected_at,
  }
}

/** Map the richer detail DTO (adds summary + optional area/finding refs). */
export function mapFireEventDetailToEnvironmentalEvent(
  detail: FireEventDetailDto,
): ThermalEnvironmentalEvent {
  const base = mapFireEventToEnvironmentalEvent(detail)
  return {
    ...base,
    summary: detail.interpretation,
    area: detail.estimated_area_ha ?? undefined,
  }
}

/** Map a single FIRMS detection (GeoJSON props) into a thermal observation. */
export function mapDetectionToThermalObservation(
  props: FireDetectionGeoJsonProperties,
  coordinates: [number, number],
): ThermalObservation {
  return {
    id: props.detection_id,
    eventType: 'thermal_activity',
    sourceAdapterId: FIRMS_SOURCE_ADAPTER_ID,
    sourceObservationId: props.detection_id,
    observedAt: props.acquired_at_utc,
    geometry: { type: 'Point', coordinates },
    attributes: {
      frp: props.frp_mw ?? undefined,
      satellite: props.satellite ?? undefined,
      confidenceLabel: props.confidence_normalized ?? undefined,
      dayNight: props.daynight ?? undefined,
    },
    rawReference: `fire_detections:${props.detection_id}`,
  }
}
