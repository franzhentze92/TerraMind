export type EventStatus = 'new' | 'active' | 'monitoring' | 'closed'
export type ValidationStatus = 'no_validado' | 'probable' | 'confirmado'
export type RiskLevel = 'informativo' | 'observacion' | 'atencion' | 'alto' | 'critico'
export type GeometryMethod = 'single_detection_buffer' | 'convex_hull_buffer'

export interface ClusterDetection {
  id: string
  latitude: number
  longitude: number
  acquired_at_utc: string
  source_product: string
  satellite: string | null
  satellite_normalized: string
  confidence_normalized: 'baja' | 'media' | 'alta' | null
  frp_mw: number | null
  department_id: string | null
  department_name: string | null
  event_id?: string | null
}

export interface ExistingEvent {
  id: string
  validation_status: ValidationStatus
  created_at: string
  status: EventStatus
  detection_ids: string[]
}

export interface PriorityComponents {
  confidence: number
  detections: number
  satellites: number
  persistence: number
  frp: number
}

export interface ScoredCluster {
  detection_ids: string[]
  validation_status: ValidationStatus
  risk_level: RiskLevel
  priority_score: number
  priority_components: PriorityComponents
  satellite_count: number
  source_products: string[]
  max_frp_mw: number | null
  department_id: string | null
  cross_department: boolean
  department_ids: string[]
  department_names: string[]
  first_detected_at: string
  last_detected_at: string
  persistence_hours: number
  geometry_method: GeometryMethod
  missing_confidence: boolean
  missing_frp: boolean
  status: EventStatus
}

export interface MergePlan {
  survivor_event_id: string
  absorbed_event_ids: string[]
  reason: string
}

export interface ConfirmedConflict {
  detection_id: string
  event_ids: string[]
  reason: string
}

export interface ClusterDryRunCluster {
  cluster_index: number
  detection_ids: string[]
  members: Array<{
    id: string
    lat: number
    lng: number
    acquired_at_utc: string
    source_product: string
    satellite_normalized: string
    department_name: string | null
  }>
  max_internal_distance_m_approx: number
  time_span_hours: number
  satellites: string[]
  department: string | null
  cross_department: boolean
  validation_status: ValidationStatus
  risk_level: RiskLevel
  priority_score: number
  proposed_action: 'create' | 'update' | 'merge'
  existing_event_id?: string
  merge_plans?: MergePlan[]
}

export interface ClusterRunMetrics {
  detections_considered: number
  detections_already_linked: number
  detections_newly_linked: number
  clusters_found: number
  events_created: number
  events_updated: number
  events_closed: number
  events_merged: number
  events_absorbed: number
  confirmed_event_conflicts: number
  detections_pending_review: number
  force_rebuild_events: number
  confirmed_events_preserved: number
  single_detection_events: number
  multi_detection_events: number
  multisatellite_events: number
  cross_department_events: number
  unlinked_detections: number
  errors: string[]
  duration_ms: number
}

export interface ClusterDryRunResult {
  dry_run: boolean
  clusters: ClusterDryRunCluster[]
  merges: MergePlan[]
  confirmed_conflicts: ConfirmedConflict[]
  events_to_update: string[]
  detections_pending_review: string[]
  metrics: ClusterRunMetrics
  write_plan?: ClusterWritePlanItem[]
}

export interface ClusterWritePlanItem {
  action: 'create' | 'update' | 'merge'
  detection_ids: string[]
  event_id?: string
  absorbed_event_ids?: string[]
  event: Record<string, unknown>
}
