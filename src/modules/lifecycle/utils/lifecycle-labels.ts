export function lifecycleStateLabel(state: string | null | undefined): string {
  const map: Record<string, string> = {
    detected: 'Detectado',
    active: 'Activo',
    persistent: 'Persistente',
    expanding: 'Expansión señalada',
    declining: 'En declive',
    inactive_monitoring: 'Monitoreo inactivo',
    resolved: 'Resuelto',
    reactivated: 'Reactivado',
    invalidated: 'Invalidado',
  }
  return state ? (map[state] ?? state) : 'Sin estado'
}

export function lifecycleStateVariant(
  state: string | null | undefined,
): 'default' | 'accent' | 'warning' | 'danger' {
  if (state === 'expanding' || state === 'reactivated') return 'warning'
  if (state === 'active' || state === 'persistent') return 'accent'
  if (state === 'resolved' || state === 'invalidated') return 'default'
  if (state === 'inactive_monitoring' || state === 'declining') return 'default'
  return 'default'
}
