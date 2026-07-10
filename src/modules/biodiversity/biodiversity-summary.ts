import type { BiodiversityOccurrence } from './biodiversity.types'
import { buildBiodiversitySearchAggregate } from './biodiversity-aggregate'
import { partitionAcceptedOccurrences } from './biodiversity-acceptance'

const FIVE_YEARS_MS = 5 * 365.25 * 24 * 60 * 60 * 1000

function parseObservedAt(iso?: string): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : null
}

export interface BiodiversityZoneSummaryInput {
  zoneName: string
  radiusKm: number
  occurrences: BiodiversityOccurrence[]
  combinedDeduplicatedCount: number
  crossProviderDuplicatePairs: number
  generatedAt: string
}

export interface BiodiversityZoneSummary {
  zone_name: string
  narrative: string
  metrics: {
    radius_km: number
    species_richness_observed: number
    records_accepted: number
    recent_observations_5y: number
    taxonomic_groups: string[]
    research_grade_count: number
    obscured_count: number
    unknown_license_count: number
    cross_provider_duplicates: number
    combined_deduplicated_total: number
    conservation_interest_note: string
    sampling_bias_note: string
    privacy_note: string
    updated_at: string
  }
}

/**
 * Resumen por reglas (sin IA) para valor de producto.
 * No afirma población, abundancia ni ausencia de especies.
 */
export function buildBiodiversityZoneSummary(input: BiodiversityZoneSummaryInput): BiodiversityZoneSummary {
  const { accepted } = partitionAcceptedOccurrences(input.occurrences)
  const aggregate = buildBiodiversitySearchAggregate(accepted)
  const now = Date.now()
  const recent = accepted.filter((o) => {
    const t = parseObservedAt(o.observedAt)
    return t !== null && now - t <= FIVE_YEARS_MS
  }).length

  const groups = Object.keys(aggregate.by_taxonomic_group).filter((g) => g !== 'unknown')
  const privacyNote =
    aggregate.obscured_count > 0
      ? `Parte de las coordenadas (${aggregate.obscured_count} registro(s)) están generalizadas u ocultas por privacidad.`
      : 'Las coordenadas visibles respetan la política de privacidad aplicada.'

  const samplingNote =
    accepted.length < 15
      ? 'La densidad de registros es baja y puede reflejar poco esfuerzo de muestreo, no ausencia biológica.'
      : 'La densidad de registros refleja también el esfuerzo de observación y el sesgo de las fuentes.'

  const conservationNote =
    'En 7C.1 no hay integración UICN/CONAP; no se etiquetan especies de interés de conservación sin fuente válida.'

  const narrative = [
    `En los últimos cinco años se documentaron ${aggregate.unique_species} especie(s) distinta(s) dentro de ${input.radiusKm} km de ${input.zoneName} (${recent} observación(es) reciente(s) en la muestra).`,
    `Se aceptaron ${accepted.length} registro(s) normalizado(s) de ${input.occurrences.length} recibido(s).`,
    groups.length > 0
      ? `Grupos taxonómicos observados: ${groups.join(', ')}.`
      : 'Grupos taxonómicos no resueltos en la muestra.',
    privacyNote,
    samplingNote,
    input.crossProviderDuplicatePairs > 0
      ? `${input.crossProviderDuplicatePairs} par(es) potencialmente duplicado(s) entre GBIF e iNaturalist en la muestra combinada.`
      : 'No se detectaron duplicados cruzados GBIF/iNaturalist en la muestra combinada.',
    conservationNote,
  ].join(' ')

  return {
    zone_name: input.zoneName,
    narrative,
    metrics: {
      radius_km: input.radiusKm,
      species_richness_observed: aggregate.unique_species,
      records_accepted: accepted.length,
      recent_observations_5y: recent,
      taxonomic_groups: groups,
      research_grade_count: aggregate.research_grade_count,
      obscured_count: aggregate.obscured_count,
      unknown_license_count: aggregate.unknown_license_count,
      cross_provider_duplicates: input.crossProviderDuplicatePairs,
      combined_deduplicated_total: input.combinedDeduplicatedCount,
      conservation_interest_note: conservationNote,
      sampling_bias_note: samplingNote,
      privacy_note: privacyNote,
      updated_at: input.generatedAt,
    },
  }
}
