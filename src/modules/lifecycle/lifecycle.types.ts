import { createHash } from 'node:crypto'

export type LifecycleEntityType = 'fire_event' | string

export type FireLifecycleState =
  | 'detected'
  | 'active'
  | 'persistent'
  | 'expanding'
  | 'declining'
  | 'inactive_monitoring'
  | 'resolved'
  | 'reactivated'
  | 'invalidated'

export interface LifecycleTransitionDef {
  from: FireLifecycleState
  to: FireLifecycleState
  rule: string
}

export interface LifecycleDetectionPoint {
  id: string
  acquired_at: string
  latitude: number
  longitude: number
  frp_mw: number | null
  source_product: string | null
}

export interface LifecycleEvaluationSnapshot {
  entity_type: LifecycleEntityType
  entity_id: string
  lifecycle_state: FireLifecycleState | null
  validation_status: string
  first_detected_at: string
  last_detected_at: string
  detection_count: number
  persistence_hours: number | null
  estimated_area_ha: number | null
  max_frp_mw: number | null
  inactive_since: string | null
  monitoring_until: string | null
  resolved_at: string | null
  reactivated_at: string | null
  last_confirmed_at: string | null
  detections: LifecycleDetectionPoint[]
}

export interface LifecycleRuleResult {
  proposed_state: FireLifecycleState
  transition_rule: string
  transition_reason: string
  correlation_kind:
    | 'continuation'
    | 'persistence'
    | 'expansion'
    | 'reactivation'
    | 'new_event'
    | 'decline'
    | 'inactivity'
    | 'resolution'
    | 'none'
  evidence_snapshot: Record<string, unknown>
  source_detection_ids: string[]
}

export interface LifecycleEvaluationResult {
  entity_type: LifecycleEntityType
  entity_id: string
  previous_state: FireLifecycleState | null
  new_state: FireLifecycleState
  transitioned: boolean
  transition_rule: string | null
  transition_reason: string
  evidence_snapshot: Record<string, unknown>
  source_detection_ids: string[]
  lifecycle_model_version: string
  context_signature: string
  correlation_kind: LifecycleRuleResult['correlation_kind']
  evaluated_at: string
  warnings: string[]
  duration_ms: number
}

export interface LifecycleProfile<TState extends string, TSnapshot> {
  entity_type: LifecycleEntityType
  model_version: string
  initial_state: TState
  terminal_states: TState[]
  allowed_transitions: Array<{ from: TState; to: TState }>
  evaluate: (snapshot: TSnapshot, evaluatedAt: string) => LifecycleRuleResult
  buildContextSignature: (snapshot: TSnapshot, modelVersion: string) => string
}

export function hashLifecycleSignature(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

export function isTransitionAllowed<TState extends string>(
  allowed: Array<{ from: TState; to: TState }>,
  from: TState | null,
  to: TState,
): boolean {
  if (!from) return true
  if (from === to) return true
  return allowed.some((t) => t.from === from && t.to === to)
}

export function sortDetectionsDeterministic(
  detections: LifecycleDetectionPoint[],
): LifecycleDetectionPoint[] {
  return [...detections].sort((a, b) => {
    const timeCmp = a.acquired_at.localeCompare(b.acquired_at)
    if (timeCmp !== 0) return timeCmp
    return a.id.localeCompare(b.id)
  })
}
