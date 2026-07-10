import { FIRMS_INGEST_SOURCES } from '@/pipeline/connectors/firms.config'

/** Ventana temporal del resumen de focos de calor (horas). */
export const FIRE_SUMMARY_WINDOW_HOURS = 48

/** Minutos sin ingesta exitosa antes de marcar datos como desactualizados. */
export const FIRE_STALE_AFTER_MINUTES = 180

/** Fuentes FIRMS esperadas en cada ciclo de ingesta. */
export const FIRE_SOURCES_EXPECTED = FIRMS_INGEST_SOURCES.length

export const FIRE_EVENTS_DEFAULT_LIMIT = 25
export const FIRE_EVENTS_MAX_LIMIT = 100

export const FIRE_PERIOD_PRESETS = {
  '24h': 24,
  '48h': 48,
  '7d': 168,
} as const

export type FirePeriodPreset = keyof typeof FIRE_PERIOD_PRESETS

export const FIRE_DEFAULT_PERIOD: FirePeriodPreset = '48h'

export const FIRE_AREA_DISCLAIMER =
  'Representación espacial aproximada del cluster. No corresponde a área quemada ni superficie afectada confirmada.'
