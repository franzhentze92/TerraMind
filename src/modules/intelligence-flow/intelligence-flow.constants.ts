import type { IntelligenceFlowStage } from './intelligence-flow.types'

export const FLOW_STAGE_ORDER: IntelligenceFlowStage[] = [
  'finding',
  'priority',
  'incident',
  'verification',
  'mission',
  'evidence',
  'resolution',
  'response',
  'report',
]

export const FLOW_STAGE_LABELS: Record<IntelligenceFlowStage, string> = {
  finding: 'Hallazgo',
  priority: 'Prioridad',
  incident: 'Incidente',
  verification: 'Verificación',
  mission: 'Misión',
  evidence: 'Evidencia',
  resolution: 'Resolución',
  response: 'Respuesta',
  report: 'Informe',
}

export const FLOW_STATUS_HINTS: Record<string, string> = {
  missing: 'Aún no existe en el ciclo operacional.',
  pending: 'En curso o pendiente de completarse.',
  not_required: 'No se requiere para esta situación.',
  blocked: 'Bloqueado por ownership o permisos.',
  legacy: 'Registro legacy — ownership pendiente.',
  demo: 'Demostración interna — no operacional.',
}
