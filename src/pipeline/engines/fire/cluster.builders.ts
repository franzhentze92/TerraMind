import { CLUSTER_CONFIG } from '@/pipeline/engines/fire/cluster.config'
import type { ScoredCluster } from '@/pipeline/stores/fire-event.types'

export interface ClusterWriteItem {
  action: 'create' | 'update' | 'merge'
  detection_ids: string[]
  event_id?: string
  absorbed_event_ids?: string[]
  scored: ScoredCluster
}

export function buildEventMetadata(scored: ScoredCluster): Record<string, unknown> {
  return {
    cluster_model_version: CLUSTER_CONFIG.clusterModelVersion,
    distance_threshold_m: CLUSTER_CONFIG.distanceThresholdM,
    time_threshold_hours: CLUSTER_CONFIG.timeThresholdHours,
    priority_model_version: CLUSTER_CONFIG.priorityModelVersion,
    priority_components: scored.priority_components,
    missing_confidence: scored.missing_confidence,
    missing_frp: scored.missing_frp,
    area_is_diagnostic: true,
    not_burned_area: true,
    cross_department: scored.cross_department,
    department_ids: scored.department_ids,
    department_names: scored.department_names,
  }
}

export function scoredToEventRow(scored: ScoredCluster, isNewThisRun: boolean) {
  return {
    status: isNewThisRun ? 'new' : scored.status,
    validation_status: scored.validation_status,
    risk_level: scored.risk_level,
    priority_score: scored.priority_score,
    first_detected_at: scored.first_detected_at,
    last_detected_at: scored.last_detected_at,
    persistence_hours: scored.persistence_hours,
    detection_count: scored.detection_ids.length,
    satellite_count: scored.satellite_count,
    source_products: scored.source_products,
    max_frp_mw: scored.max_frp_mw,
    country_code: 'GT',
    department_id: scored.department_id,
    municipality_id: null,
    geometry_method: scored.geometry_method,
    metadata: buildEventMetadata(scored),
  }
}
