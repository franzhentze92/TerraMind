/**
 * Salud operativa por fuente (independiente de si publicó notas nuevas).
 */
export type NewsSourceHealthCode =
  | 'operativa'
  | 'operativa_con_advertencias'
  | 'sin_actualizaciones'
  | 'degradada'
  | 'no_disponible'
  | 'configuracion_incompleta'

export const NEWS_SOURCE_HEALTH_LABELS: Record<NewsSourceHealthCode, string> = {
  operativa: 'Operativa',
  operativa_con_advertencias: 'Operativa con advertencias',
  sin_actualizaciones: 'Sin actualizaciones',
  degradada: 'Degradada',
  no_disponible: 'No disponible',
  configuracion_incompleta: 'Configuración incompleta',
}

export interface SourceHealthInput {
  isEnabled: boolean
  discoveryMethod?: string | null
  baseUrl?: string | null
  consecutiveFailureCount: number
  lastSuccessfulIngestionAt: string | null
  lastFailedIngestionAt: string | null
  /** Horas desde el último documento nuevo (opcional). */
  hoursSinceLastNewDocument?: number | null
  hasConnector?: boolean
}

export function deriveSourceHealth(input: SourceHealthInput): {
  code: NewsSourceHealthCode
  label: string
} {
  if (!input.isEnabled) {
    return { code: 'no_disponible', label: NEWS_SOURCE_HEALTH_LABELS.no_disponible }
  }
  if (!input.hasConnector || !input.baseUrl || !input.discoveryMethod) {
    return {
      code: 'configuracion_incompleta',
      label: NEWS_SOURCE_HEALTH_LABELS.configuracion_incompleta,
    }
  }
  if (input.consecutiveFailureCount >= 3) {
    return { code: 'degradada', label: NEWS_SOURCE_HEALTH_LABELS.degradada }
  }
  if (input.consecutiveFailureCount >= 1) {
    return {
      code: 'operativa_con_advertencias',
      label: NEWS_SOURCE_HEALTH_LABELS.operativa_con_advertencias,
    }
  }
  if (
    input.lastSuccessfulIngestionAt &&
    input.hoursSinceLastNewDocument != null &&
    input.hoursSinceLastNewDocument > 72
  ) {
    return {
      code: 'sin_actualizaciones',
      label: NEWS_SOURCE_HEALTH_LABELS.sin_actualizaciones,
    }
  }
  if (!input.lastSuccessfulIngestionAt && input.lastFailedIngestionAt) {
    return { code: 'degradada', label: NEWS_SOURCE_HEALTH_LABELS.degradada }
  }
  return { code: 'operativa', label: NEWS_SOURCE_HEALTH_LABELS.operativa }
}
