const SEVERITY_LABELS: Record<string, string> = {
  informational: 'Informativo',
  attention: 'Atención',
  elevated_attention: 'Atención elevada',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Alta',
  moderate: 'Moderada',
  low: 'Baja',
  insufficient: 'Insuficiente',
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  monitoring: 'Monitoreo',
  resolved: 'Resuelto',
  superseded: 'Reemplazado',
  dismissed: 'Descartado',
}

export function findingSeverityLabel(value: string): string {
  return SEVERITY_LABELS[value] ?? value
}

export function findingConfidenceLabel(value: string): string {
  return CONFIDENCE_LABELS[value] ?? value
}

export function findingStatusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value
}

export function findingDomainLabel(domain: string): string {
  const map: Record<string, string> = {
    fire_events: 'Eventos térmicos',
    protected_areas: 'Áreas protegidas',
    land_cover: 'Cobertura del suelo',
    population: 'Población',
    climate: 'Clima',
    biodiversity: 'Biodiversidad',
  }
  return map[domain] ?? domain
}

/** Human interpretation for each finding rule code (internal codes never reach the UI). */
const RULE_INTERPRETATIONS: Record<string, string> = {
  THERMAL_PROTECTED_AREA_001: 'La actividad térmica se ubica dentro de un área protegida.',
  THERMAL_PROTECTED_AREA_002: 'La actividad térmica se ubica cerca de un área protegida.',
  THERMAL_LAND_COVER_001:
    'La actividad térmica coincide espacialmente con cobertura forestal.',
  THERMAL_LAND_COVER_002:
    'La actividad térmica coincide espacialmente con una zona de cobertura natural combinada.',
  THERMAL_CLIMATE_001: 'Se registraron condiciones secas en el entorno del evento.',
  THERMAL_CLIMATE_002: 'Se registró viento elevado durante la detección.',
  THERMAL_POPULATION_001: 'Hay población modelada en el entorno inmediato.',
  THERMAL_POPULATION_002: 'Existe alta incertidumbre en la estimación poblacional local.',
  THERMAL_BIODIVERSITY_001: 'Hay biodiversidad documentada en el entorno.',
  THERMAL_BIODIVERSITY_002: 'El contexto de biodiversidad presenta limitaciones.',
  THERMAL_MULTI_001: 'Múltiples contextos coinciden y requieren atención conjunta.',
}

export function findingRuleInterpretation(code: string): string {
  return RULE_INTERPRETATIONS[code] ?? 'Interpretación derivada de reglas de contexto territorial.'
}
