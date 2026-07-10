export function attentionLevelLabel(level: string): string {
  const map: Record<string, string> = {
    routine: 'Rutina',
    monitor: 'Monitoreo',
    review: 'Revisión',
    high_attention: 'Atención alta',
    priority_attention: 'Atención prioritaria',
  }
  return map[level] ?? level
}

export function verificationLevelLabel(level: string): string {
  const map: Record<string, string> = {
    not_required: 'No requerida',
    useful: 'Útil',
    recommended: 'Recomendada',
    high_priority: 'Alta prioridad',
  }
  return map[level] ?? level
}

export function actionLevelLabel(level: string): string {
  const map: Record<string, string> = {
    none: 'Ninguna',
    prepare: 'Preparar',
    coordinate: 'Coordinar',
    operational_attention: 'Atención operativa',
  }
  return map[level] ?? level
}

export function domainLabel(domain: string): string {
  const map: Record<string, string> = {
    protected_areas: 'Áreas protegidas',
    land_cover: 'Cobertura del suelo',
    climate: 'Clima',
    population: 'Población',
    biodiversity: 'Biodiversidad',
    composite: 'Concurrencia',
    persistence: 'Persistencia',
  }
  return map[domain] ?? domain
}
