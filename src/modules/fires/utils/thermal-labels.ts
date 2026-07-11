import type { FirePeriodPreset } from '@/modules/fires/config/fire.constants'
import { sourceProductDisplayName } from '@/modules/fires/utils/source-labels'

/** FIRMS as proper noun with Spanish explanation for UI. */
export const FIRMS_DISPLAY =
  'FIRMS · Sistema de información satelital sobre actividad térmica'

export const THERMAL_SCIENTIFIC_DISCLAIMER =
  'Una detección térmica no confirma por sí sola la existencia de un incendio.'

export const THERMAL_METHODOLOGY_SUMMARY =
  'Las observaciones provienen de sensores satelitales; las detecciones nacionales son puntos válidos dentro de Guatemala; los eventos térmicos agrupan detecciones cercanas en el tiempo y el espacio.'

const PERIOD_LABELS: Record<FirePeriodPreset, string> = {
  '24h': 'últimas 24 horas',
  '48h': 'últimas 48 horas',
  '7d': 'últimos 7 días',
}

export function thermalPeriodLabel(period: FirePeriodPreset): string {
  return PERIOD_LABELS[period]
}

export function pluralizeCount(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export function firmsProviderSummary(operational: number, expected: number): string {
  return `Proveedores FIRMS operativos: ${operational} de ${expected}`
}

export function ingestionStatusLabel(source: string): string {
  return sourceProductDisplayName(source)
}

const INGESTION_STATUS_LABELS: Record<string, string> = {
  success: 'Completada',
  partial: 'Parcial',
  failed: 'Fallida',
  running: 'En ejecución',
}

export function ingestionRunStatusLabel(status: string): string {
  return INGESTION_STATUS_LABELS[status] ?? status
}

/** Lifecycle presentation for thermal events (product copy). */
export function thermalLifecycleLabel(state: string | null | undefined): string {
  if (!state) return 'Sin estado'
  const key = state.replace(/^lifecycle_/, '')
  const map: Record<string, string> = {
    detected: 'En formación',
    active: 'En formación',
    expanding: 'En expansión',
    persistent: 'Persistente',
    declining: 'En descenso',
    resolved: 'Finalizado',
    inactive_monitoring: 'Finalizado',
    invalidated: 'Finalizado',
    reactivated: 'En expansión',
  }
  return map[key] ?? map[state] ?? 'Sin estado'
}

export function detectionsToggleLabel(enabled: boolean): string {
  return enabled ? 'Activado' : 'Desactivado'
}

export function filterEmptyMessage(hasActiveFilters: boolean): string {
  return hasActiveFilters
    ? 'Sin resultados para estos filtros.'
    : 'No hay eventos térmicos en el periodo seleccionado.'
}
