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

/** One-line meaning for each dimension level, so labels are never bare. */
export function attentionLevelDescription(level: string): string {
  const map: Record<string, string> = {
    routine: 'Seguimiento normal, sin urgencia.',
    monitor: 'Observar la evolución en próximas actualizaciones.',
    review: 'Conviene revisarlo pronto en el mapa y la cola.',
    high_attention: 'Requiere revisión priorizada.',
    priority_attention: 'Atención inmediata recomendada.',
  }
  return map[level] ?? 'Nivel de atención asignado por el modelo.'
}

export function verificationLevelDescription(level: string): string {
  const map: Record<string, string> = {
    not_required: 'No hace falta verificación adicional por ahora.',
    useful: 'Verificar aportaría contexto, pero no es indispensable.',
    recommended: 'Se recomienda verificar antes de decidir.',
    high_priority: 'Verificar es clave para confirmar el caso.',
  }
  return map[level] ?? 'Valor esperado de verificar este caso.'
}

export function actionLevelDescription(level: string): string {
  const map: Record<string, string> = {
    none: 'No se requiere preparación operativa.',
    prepare: 'Alistar recursos por si escala.',
    coordinate: 'Coordinar con actores responsables.',
    operational_attention: 'Requiere atención operativa activa.',
  }
  return map[level] ?? 'Nivel de preparación operativa sugerido.'
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
