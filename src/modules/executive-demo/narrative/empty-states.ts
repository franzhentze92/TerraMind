import type { EmptyStateInfo } from '../types/executive-demo.types'

export function emptyState(section: string, overrides: Partial<EmptyStateInfo>): EmptyStateInfo {
  return {
    section,
    title: overrides.title ?? section,
    meaning: overrides.meaning ?? '',
    why_empty: overrides.why_empty ?? '',
    fed_by: overrides.fed_by ?? '',
    last_known: overrides.last_known ?? null,
    action: overrides.action ?? null,
  }
}

export const RESPONSE_ASSESSMENTS_EMPTY = emptyState('response_assessments', {
  title: 'Respuestas recomendadas',
  meaning: 'Evaluaciones de respuesta operacional generadas tras resolución de verificación.',
  why_empty:
    'No existen response assessments todavía. Se generarán cuando una resolución de verificación tenga todas sus reevaluaciones downstream completas.',
  fed_by: 'Motor 8C.1 — Response Orchestration (post-resolución)',
  action: 'Ver resoluciones y misiones en curso',
})

export const DECISIONS_EMPTY = emptyState('decisions', {
  title: 'Decisiones pendientes',
  meaning: 'Decisiones humanas sobre recomendaciones de respuesta.',
  why_empty: 'No hay decisiones registradas porque aún no existen assessments activos.',
  fed_by: 'Flujo de aprobación de respuesta (8C.1)',
})

export const RESOLUTIONS_EMPTY = emptyState('resolutions', {
  title: 'Resoluciones de verificación',
  meaning: 'Conclusiones formales sobre necesidades de verificación.',
  why_empty:
    'No hay resoluciones activas. Requieren evidencia validada y evaluación del motor de resolución.',
  fed_by: 'Motor de resolución de verificación (8B.6)',
})

export const VALIDATIONS_EMPTY = emptyState('validations', {
  title: 'Validaciones de evidencia',
  meaning: 'Revisión de calidad y coherencia de evidencia de campo.',
  why_empty: 'No hay validaciones completadas. La evidencia recibida aún está pendiente de validación.',
  fed_by: 'Motor de validación de evidencia (8B.5)',
})

export const TENANT_INCIDENTS_EMPTY = emptyState('tenant_incidents', {
  title: 'Incidentes de organización',
  meaning: 'Incidentes con ownership de tenant asignado.',
  why_empty:
    'Los incidentes actuales en base son legacy (sin organization_id). Los incidentes tenant-owned aparecerán tras correlación con organización activa.',
  fed_by: 'Correlación de incidentes + provisioning de tenant (8B.7)',
})
