import type { BiodiversityContextDto } from '@/modules/fires/types/fire.dto'
import { BIODIVERSITY_TAXON_GROUP_LABELS } from '@/modules/biodiversity/biodiversity-taxon-groups'

const RELATION_LABELS: Record<string, string> = {
  inside: 'dentro de',
  intersects: 'en el entorno de',
  near: 'cerca de',
  outside: 'fuera de',
  unavailable: 'sin relación territorial resuelta con',
}

export function buildBiodiversityEventNarrative(context: BiodiversityContextDto): string | null {
  const largest = context.zones[context.zones.length - 1]
  if (!largest) return null

  const radiusKm = largest.radius_m / 1000
  const parts: string[] = []

  if (largest.unique_species_documented > 0) {
    parts.push(
      `En el entorno de ${radiusKm} km se han documentado ${largest.unique_species_documented} especie(s) durante los últimos ${context.history_window.years} años.`,
    )
  }

  if (largest.observations_recent_30d > 0) {
    parts.push(
      `Se registraron ${largest.observations_recent_30d} observación(es) durante los últimos ${context.recent_window.days} días.`,
    )
  }

  if (largest.spatially_excluded_count > 0) {
    parts.push(
      'Parte de los registros fue excluida de los radios pequeños por precisión espacial limitada.',
    )
  }

  const zone = context.monitored_zone_context
  if (zone.zone_name && zone.relation && zone.relation !== 'unavailable' && zone.relation !== 'outside') {
    parts.push(
      `El evento se encuentra ${RELATION_LABELS[zone.relation] ?? 'respecto a'} una zona con biodiversidad documentada (${zone.zone_name}).`,
    )
  }

  if (
    context.summary.quality.level === 'limited' ||
    context.summary.quality.level === 'very_limited'
  ) {
    parts.push('La baja cantidad de registros puede reflejar menor esfuerzo de observación.')
  }

  return parts.length ? parts.join(' ') : null
}

export function topTaxaGroups(
  distribution: Record<string, number>,
  limit = 4,
): Array<{ key: string; label: string; count: number }> {
  return Object.entries(distribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({
      key,
      label: BIODIVERSITY_TAXON_GROUP_LABELS[key as keyof typeof BIODIVERSITY_TAXON_GROUP_LABELS] ?? key,
      count,
    }))
}

export function containsAffectedSpeciesLanguage(text: string): boolean {
  const forbidden = [
    /especies afectadas/i,
    /biodiversidad dañada/i,
    /pérdida de fauna/i,
    /impacto ecológico confirmado/i,
    /estaban presentes durante el evento/i,
    /en riesgo/i,
  ]
  return forbidden.some((re) => re.test(text))
}
