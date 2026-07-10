import type { ProtectedAreaContextDto } from '@/modules/fires/types/fire.dto'

export function buildTerritorySummaryText(dto: ProtectedAreaContextDto): string {
  if (dto.status === 'unavailable') {
    return 'Contexto de áreas protegidas no disponible.'
  }

  if (dto.inside_protected_area && dto.intersecting_areas.length > 0) {
    const names = dto.intersecting_areas.map((a) => a.display_name).join(', ')
    return `Este evento intersecta el área protegida ${names}. Requiere revisión territorial prioritaria.`
  }

  if (dto.nearest_area?.display_name && dto.nearest_area.distance_m != null) {
    const km = (dto.nearest_area.distance_m / 1000).toFixed(1)
    return `Este evento no intersecta un área protegida. El área protegida más cercana (${dto.nearest_area.display_name}) se encuentra a ${km} km.`
  }

  return 'Este evento no intersecta un área protegida según las ubicaciones satelitales disponibles.'
}

export function territoryStatusLabel(inside: boolean | null | undefined): string {
  if (inside == null) return '—'
  return inside ? 'Dentro' : 'Fuera'
}

export function territoryDisclaimer(inside: boolean | null | undefined): string | null {
  if (inside == null) return null
  if (inside) {
    return 'No significa por sí solo que exista daño confirmado dentro del área.'
  }
  return 'No intersecta según las ubicaciones satelitales disponibles.'
}
