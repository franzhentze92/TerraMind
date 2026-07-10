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
