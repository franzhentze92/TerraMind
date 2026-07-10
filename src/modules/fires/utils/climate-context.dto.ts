import {
  CLIMATE_FIRE_API_DISCLAIMER,
  CLIMATE_FIRE_SOURCE_MODEL,
  CLIMATE_FIRE_SOURCE_PROVIDER,
  CLIMATE_FIRE_TIMEZONE,
} from '@/modules/fires/config/climate.constants'
import type {
  ClimateContextDto,
  ClimateContextStatus,
  ClimateEnrichmentStateDto,
  ClimateNumericRangeDto,
  ClimateWindDirectionDto,
} from '@/modules/fires/types/fire.dto'
import type { ClimateContextRow } from '@/pipeline/stores/climate.store'

const WARNING_MESSAGES: Record<string, string> = {
  temporal_match_outside_tolerance:
    'No se encontró una hora modelada suficientemente próxima a la detección.',
  spatial_weather_variability: 'Variabilidad espacial entre puntos consultados.',
  provider_partial: 'Al menos un punto no pudo consultarse completamente.',
  forecast_unavailable: 'Pronóstico modelado no disponible para este evento.',
  antecedent_window_incomplete: 'Ventana antecedente incompleta para acumulados largos.',
  centroid_fallback: 'Consulta basada en centroide por ausencia de detecciones válidas.',
  point_query_failed: 'Fallo al consultar clima en al menos un punto.',
}

function mapWarnings(codes: unknown): string[] {
  if (!Array.isArray(codes)) return []
  return codes.map((code) => WARNING_MESSAGES[String(code)] ?? String(code)).filter(Boolean)
}

function asRange(raw: unknown): ClimateNumericRangeDto | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  return {
    mean: obj.mean != null ? Number(obj.mean) : null,
    min: obj.min != null ? Number(obj.min) : null,
    max: obj.max != null ? Number(obj.max) : null,
  }
}

function asWind(raw: unknown): ClimateWindDirectionDto | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  return {
    degrees: obj.degrees != null ? Number(obj.degrees) : null,
    cardinal: obj.cardinal != null ? String(obj.cardinal) : null,
    toward_cardinal: obj.toward_cardinal != null ? String(obj.toward_cardinal) : null,
  }
}

export function buildClimateContextDto(
  context: ClimateContextRow | null,
  options?: { eventLastLinkedAt?: string | null },
): ClimateContextDto | null {
  if (!context) return null

  let status = context.status as ClimateContextStatus
  if (
    options?.eventLastLinkedAt &&
    context.generated_at &&
    options.eventLastLinkedAt > context.generated_at &&
    status === 'complete'
  ) {
    status = 'stale'
  }

  const conditions = context.conditions_summary ?? {}
  const antecedent = context.antecedent_summary ?? {}
  const forecast = context.forecast_summary ?? {}
  const metadata = context.source_metadata ?? {}

  return {
    status,
    source: {
      provider: CLIMATE_FIRE_SOURCE_PROVIDER,
      model: CLIMATE_FIRE_SOURCE_MODEL,
      data_type: 'modelled_weather',
      generated_at: context.generated_at,
      timezone: CLIMATE_FIRE_TIMEZONE,
    },
    event_conditions: {
      matched_time:
        conditions.matched_time != null ? String(conditions.matched_time) : null,
      temperature_c: asRange(conditions.temperature_c),
      relative_humidity_pct: asRange(conditions.relative_humidity_pct),
      wind_speed_kmh: asRange(conditions.wind_speed_kmh),
      wind_gust_kmh: asRange(conditions.wind_gust_kmh),
      wind_direction: asWind(conditions.wind_direction),
      precipitation_mm: asRange(conditions.precipitation_mm),
      cloud_cover_pct: asRange(conditions.cloud_cover_pct),
    },
    antecedent: {
      precipitation_previous_24h_mm:
        antecedent.precipitation_previous_24h_mm != null
          ? Number(antecedent.precipitation_previous_24h_mm)
          : null,
      precipitation_previous_7d_mm:
        antecedent.precipitation_previous_7d_mm != null
          ? Number(antecedent.precipitation_previous_7d_mm)
          : null,
      precipitation_previous_30d_mm:
        antecedent.precipitation_previous_30d_mm != null
          ? Number(antecedent.precipitation_previous_30d_mm)
          : null,
      dry_days_consecutive:
        antecedent.dry_days_consecutive != null
          ? Number(antecedent.dry_days_consecutive)
          : null,
      max_temperature_previous_24h_c:
        antecedent.max_temperature_previous_24h_c != null
          ? Number(antecedent.max_temperature_previous_24h_c)
          : null,
      min_relative_humidity_previous_24h_pct:
        antecedent.min_relative_humidity_previous_24h_pct != null
          ? Number(antecedent.min_relative_humidity_previous_24h_pct)
          : null,
    },
    forecast: {
      available: Boolean(forecast.available),
      precipitation_next_24h_mm:
        forecast.precipitation_next_24h_mm != null
          ? Number(forecast.precipitation_next_24h_mm)
          : null,
      precipitation_next_72h_mm:
        forecast.precipitation_next_72h_mm != null
          ? Number(forecast.precipitation_next_72h_mm)
          : null,
      max_temperature_next_24h_c:
        forecast.max_temperature_next_24h_c != null
          ? Number(forecast.max_temperature_next_24h_c)
          : null,
      min_relative_humidity_next_24h_pct:
        forecast.min_relative_humidity_next_24h_pct != null
          ? Number(forecast.min_relative_humidity_next_24h_pct)
          : null,
      max_wind_speed_next_24h_kmh:
        forecast.max_wind_speed_next_24h_kmh != null
          ? Number(forecast.max_wind_speed_next_24h_kmh)
          : null,
      max_wind_gust_next_24h_kmh:
        forecast.max_wind_gust_next_24h_kmh != null
          ? Number(forecast.max_wind_gust_next_24h_kmh)
          : null,
    },
    spatial_variability: {
      point_count: context.point_count,
      level:
        ((metadata.spatial_variability as { level?: string } | undefined)?.level as
          | 'low'
          | 'moderate'
          | 'high'
          | undefined) ?? 'low',
    },
    temporal_alignment:
      (context.temporal_alignment as ClimateContextDto['temporal_alignment']) ?? 'partial',
    geometry_source:
      (context.geometry_source as ClimateContextDto['geometry_source']) ?? 'detections_sample',
    warnings: mapWarnings(context.warnings),
    disclaimer: CLIMATE_FIRE_API_DISCLAIMER,
  }
}

export function buildClimateEnrichmentState(
  context: ClimateContextDto | null,
  activeJob: { status: string } | null,
): ClimateEnrichmentStateDto | null {
  if (context) {
    return { status: 'complete', message: null }
  }
  if (!activeJob) {
    return {
      status: 'unavailable',
      message: 'Contexto climático aún no calculado.',
    }
  }
  if (activeJob.status === 'pending') {
    return { status: 'queued', message: 'Contexto climático en cola de procesamiento.' }
  }
  if (activeJob.status === 'processing') {
    return { status: 'processing', message: 'Contexto climático en procesamiento.' }
  }
  return { status: 'unavailable', message: 'Contexto climático aún no calculado.' }
}

export const CLIMATE_SENSITIVE_KEYS = [
  'latitude',
  'longitude',
  'api.open-meteo.com',
  'cache_key',
] as const
