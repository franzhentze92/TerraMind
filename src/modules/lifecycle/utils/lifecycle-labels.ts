import { humanizeToken } from '@/shared/product-language'

export function lifecycleStateLabel(state: string | null | undefined): string {
  const map: Record<string, string> = {
    detected: 'Detectado',
    active: 'Activo',
    persistent: 'Persistente',
    expanding: 'En expansión',
    declining: 'En descenso',
    inactive_monitoring: 'Monitoreo inactivo',
    resolved: 'Resuelto',
    reactivated: 'Reactivado',
    invalidated: 'Invalidado',
  }
  if (!state) return 'Sin estado'
  // Data may arrive with the `lifecycle_` prefix (e.g. `lifecycle_expanding`).
  const key = state.replace(/^lifecycle_/, '')
  return map[key] ?? map[state] ?? humanizeToken(key)
}

export function lifecycleStateVariant(
  state: string | null | undefined,
): 'default' | 'accent' | 'warning' | 'danger' {
  const key = state ? state.replace(/^lifecycle_/, '') : state
  if (key === 'expanding' || key === 'reactivated') return 'warning'
  if (key === 'active' || key === 'persistent') return 'accent'
  if (key === 'resolved' || key === 'invalidated') return 'default'
  if (key === 'inactive_monitoring' || key === 'declining') return 'default'
  return 'default'
}
