import {
  BIODIVERSITY_FIRE_API_DISCLAIMER,
} from '@/modules/fires/config/biodiversity.constants'
import type {
  BiodiversityContextDto,
  BiodiversityContextStatus,
  BiodiversityEnrichmentStateDto,
} from '@/modules/fires/types/fire.dto'
import type {
  BiodiversityContextRow,
  BiodiversityVisualHighlightRow,
  BiodiversityZoneRow,
} from '@/pipeline/stores/biodiversity-event.store'
import { BIODIVERSITY_EVENT_CONFIG } from '@/modules/biodiversity/config/biodiversity-event.config'

const WARNING_MESSAGES: Record<string, string> = {
  event_centroid_fallback: 'Análisis basado en centroide por ausencia de detecciones válidas.',
  detection_spread_wide: 'Las detecciones están muy dispersas respecto al radio analizado.',
  sample_truncated: 'La muestra de registros fue truncada por límites del proveedor.',
  provider_unavailable: 'Al menos un proveedor no estuvo disponible en esta consulta.',
  spatial_precision_limited:
    'Parte de los registros fue excluida de radios pequeños por precisión espacial limitada.',
  low_observation_effort: 'La baja cantidad de registros puede reflejar menor esfuerzo de observación.',
  no_recent_observations: 'No hay observaciones recientes documentadas en la muestra.',
  historical_only: 'Los registros disponibles son principalmente históricos.',
  license_limited_media: 'Pocas imágenes con licencia utilizable en la muestra.',
  event_outside_monitored_zones: 'El evento está fuera de las zonas monitoreadas principales.',
  high_duplicate_rate: 'Alta tasa de posibles duplicados entre fuentes.',
  single_provider_only: 'Solo un proveedor aportó datos en esta consulta.',
  provider_partial: 'Cobertura parcial de proveedores.',
}

function mapWarnings(codes: unknown): string[] {
  if (!Array.isArray(codes)) return []
  return codes.map((code) => WARNING_MESSAGES[String(code)] ?? String(code)).filter(Boolean)
}

function mapZone(row: BiodiversityZoneRow) {
  return {
    radius_m: row.radius_m,
    unique_species_documented: row.unique_species_documented,
    observations_documented: row.observations_documented,
    observations_recent_30d: row.observations_recent_30d,
    observations_recent_90d: row.observations_recent_90d,
    event_window_observations: row.event_window_observations,
    gbif_count: row.gbif_count,
    inaturalist_count: row.inaturalist_count,
    research_grade_inaturalist: row.research_grade_inaturalist,
    generalized_count: row.generalized_count,
    obscured_count: row.obscured_count,
    spatially_excluded_count: row.spatially_excluded_count,
    duplicated_count: row.duplicated_count,
    media_usable_count: row.media_usable_count,
    latest_observation_at: row.latest_observation_at,
    taxa_distribution: row.taxa_distribution ?? {},
    truncated: row.truncated,
    quality: row.data_quality ?? {},
    warnings: mapWarnings(row.warnings),
  }
}

function mapVisual(row: BiodiversityVisualHighlightRow) {
  return {
    common_name: row.common_name,
    taxon_name: row.taxon_name,
    taxonomic_group: row.taxonomic_group,
    thumbnail_url: row.thumbnail_url,
    image_url: row.image_url,
    image_license: row.image_license,
    image_attribution: row.image_attribution,
    observation_url: row.observation_url,
    observed_at: row.observed_at,
    privacy_status: row.privacy_status,
    source: row.source as 'gbif' | 'inaturalist',
  }
}

export function buildBiodiversityContextDto(
  context: BiodiversityContextRow | null,
  zones: BiodiversityZoneRow[],
  highlights: BiodiversityVisualHighlightRow[],
  options?: { eventLastLinkedAt?: string | null },
): BiodiversityContextDto | null {
  if (!context) return null

  let status = context.status as BiodiversityContextStatus
  if (
    options?.eventLastLinkedAt &&
    context.generated_at &&
    options.eventLastLinkedAt > context.generated_at &&
    status === 'complete'
  ) {
    status = 'stale'
  }

  const summary = context.summary ?? {}
  const quality = (context.quality ?? {}) as BiodiversityContextDto['summary']['quality']
  const monitored = context.monitored_zone_context ?? {}
  const providerStatus = context.provider_status ?? {}

  const providerDistribution: BiodiversityContextDto['summary']['provider_distribution'] = {}
  if (providerStatus.gbif === 'ok') {
    providerDistribution.gbif = Number(summary.provider_distribution?.gbif ?? zones.at(-1)?.gbif_count ?? 0)
  }
  if (providerStatus.inaturalist === 'ok') {
    providerDistribution.inaturalist = Number(
      summary.provider_distribution?.inaturalist ?? zones.at(-1)?.inaturalist_count ?? 0,
    )
  }

  const primaryZone = (monitored as { primary?: { relation?: string; name?: string; zone_code?: string } })
    .primary

  return {
    status,
    generated_at: context.generated_at,
    context_version: context.context_version,
    geometry_source:
      (context.geometry_source as BiodiversityContextDto['geometry_source']) ?? 'detections_union',
    history_window: { years: BIODIVERSITY_EVENT_CONFIG.historyYears },
    recent_window: { days: BIODIVERSITY_EVENT_CONFIG.recentDays },
    summary: {
      unique_species_documented: Number(summary.unique_species_documented ?? 0),
      observations_documented: Number(summary.observations_documented ?? 0),
      observations_recent_30d: Number(summary.observations_recent_30d ?? 0),
      observations_recent_90d: Number(summary.observations_recent_90d ?? 0),
      provider_distribution: providerDistribution,
      taxa_distribution: (summary.taxa_distribution as Record<string, number>) ?? {},
      quality: {
        level: quality.level ?? 'moderate',
        reasons: Array.isArray(quality.reasons) ? quality.reasons.map(String) : [],
      },
    },
    zones: zones.map(mapZone),
    monitored_zone_context: primaryZone
      ? {
          relation: (primaryZone.relation as BiodiversityContextDto['monitored_zone_context']['relation']) ?? 'unavailable',
          zone_name: primaryZone.name ?? null,
          zone_code: primaryZone.zone_code ?? null,
          distance_m: (primaryZone as { distance_m?: number }).distance_m ?? null,
        }
      : { relation: 'unavailable', zone_name: null, zone_code: null, distance_m: null },
    visual_highlights: highlights.map(mapVisual),
    provider_status: {
      gbif: providerStatus.gbif === 'ok' ? 'ok' : providerStatus.gbif === 'error' ? 'error' : 'unavailable',
      inaturalist:
        providerStatus.inaturalist === 'ok'
          ? 'ok'
          : providerStatus.inaturalist === 'error'
            ? 'error'
            : 'unavailable',
    },
    warnings: mapWarnings(context.warnings),
    disclaimer: BIODIVERSITY_FIRE_API_DISCLAIMER,
  }
}

export function buildBiodiversityEnrichmentState(
  context: BiodiversityContextDto | null,
  activeJob: { status: string } | null,
): BiodiversityEnrichmentStateDto | null {
  if (context) {
    return { status: 'complete', message: null }
  }
  if (!activeJob) {
    return {
      status: 'unavailable',
      message: 'Contexto ecológico aún no calculado.',
    }
  }
  if (activeJob.status === 'pending') {
    return { status: 'queued', message: 'Evidencia ecológica en cola de procesamiento.' }
  }
  if (activeJob.status === 'processing') {
    return { status: 'processing', message: 'Consultando fuentes de biodiversidad documentada…' }
  }
  return { status: 'failed', message: 'No se pudo calcular el contexto ecológico.' }
}
