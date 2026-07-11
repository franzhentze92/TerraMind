import type { ResponseLevel, DecisionStatus } from '@/modules/response-orchestration/response-orchestration.types'

export type ResponseBadgeKey =
  | 'monitoreo'
  | 'verificacion_adicional'
  | 'respuesta_interna'
  | 'seguimiento_operacional'
  | 'revision_autorizada'
  | 'pendiente_decision'
  | 'accion_en_curso'
  | 'cierre_recomendado'
  | 'bloqueado_incertidumbre'
  | 'ownership_unresolved'

export const RESPONSE_BADGE_LABELS: Record<ResponseBadgeKey, string> = {
  monitoreo: 'Monitoreo',
  verificacion_adicional: 'Verificación adicional',
  respuesta_interna: 'Respuesta interna',
  seguimiento_operacional: 'Seguimiento operacional',
  revision_autorizada: 'Revisión autorizada',
  pendiente_decision: 'Pendiente de decisión',
  accion_en_curso: 'Acción en curso',
  cierre_recomendado: 'Cierre recomendado',
  bloqueado_incertidumbre: 'Bloqueado por incertidumbre',
  ownership_unresolved: 'Ownership sin resolver',
}

export function resolveResponseBadge(input: {
  recommended_level?: ResponseLevel | string | null
  decision_status?: DecisionStatus | string | null
  assessment_status?: string | null
  has_executing_action?: boolean
  ownership_unresolved?: boolean
}): ResponseBadgeKey {
  if (input.ownership_unresolved) return 'ownership_unresolved'
  if (input.assessment_status === 'blocked_inconsistent_snapshot') return 'bloqueado_incertidumbre'
  if (input.has_executing_action || input.decision_status === 'executing') return 'accion_en_curso'
  if (input.decision_status === 'approved') return 'revision_autorizada'
  if (input.decision_status === 'modified' || input.decision_status === 'rejected') return 'pendiente_decision'
  if (input.recommended_level === 'escalate_for_authorized_review') return 'revision_autorizada'
  if (input.recommended_level === 'request_additional_verification') return 'verificacion_adicional'
  if (input.recommended_level === 'prepare_internal_response') return 'respuesta_interna'
  if (input.recommended_level === 'operational_follow_up') return 'seguimiento_operacional'
  if (input.recommended_level === 'continue_monitoring' || input.recommended_level === 'no_response_required') {
    return 'monitoreo'
  }
  if (input.recommended_level === 'coordinate_with_responsible_party') return 'seguimiento_operacional'
  return 'pendiente_decision'
}

export function responseLevelLabel(level: string): string {
  const map: Record<string, string> = {
    no_response_required: 'Sin respuesta requerida',
    continue_monitoring: 'Continuar monitoreo',
    request_additional_verification: 'Verificación adicional',
    prepare_internal_response: 'Respuesta interna',
    coordinate_with_responsible_party: 'Coordinación con responsable',
    operational_follow_up: 'Seguimiento operacional',
    escalate_for_authorized_review: 'Revisión autorizada',
  }
  return map[level] ?? level
}

export function decisionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    recommended: 'Recomendación del motor',
    pending_review: 'Pendiente de revisión',
    approved: 'Aprobada',
    modified: 'Modificada',
    rejected: 'Rechazada',
    superseded: 'Supersedida',
    executing: 'En ejecución',
    completed: 'Completada',
    cancelled: 'Cancelada',
  }
  return map[status] ?? status
}
