/**
 * Canonical date/time presentation helper.
 *
 * Product Consolidation — Phase 1. Single source of truth for how timestamps
 * are shown across the product. Everything is stored/handled in UTC and only
 * presented in Guatemala time here. Do not build ad-hoc Intl.DateTimeFormat
 * calls in feature code — use these functions so formats and timezone stay
 * consistent.
 */

export const GUATEMALA_TIMEZONE = 'America/Guatemala'
export const PRESENTATION_LOCALE = 'es-GT'

function toDate(value: string | number | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** e.g. "8 jul, 22:43" — Guatemala time, 24h. */
export function formatGtDateTime(utc: string | number | Date | null | undefined): string {
  if (utc == null) return '—'
  const d = toDate(utc)
  if (!d) return '—'
  return new Intl.DateTimeFormat(PRESENTATION_LOCALE, {
    timeZone: GUATEMALA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** e.g. "8 jul 2026" — Guatemala date only. */
export function formatGtDate(utc: string | number | Date | null | undefined): string {
  if (utc == null) return '—'
  const d = toDate(utc)
  if (!d) return '—'
  return new Intl.DateTimeFormat(PRESENTATION_LOCALE, {
    timeZone: GUATEMALA_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/** e.g. "22:43" — Guatemala time only, 24h. */
export function formatGtTime(utc: string | number | Date | null | undefined): string {
  if (utc == null) return '—'
  const d = toDate(utc)
  if (!d) return '—'
  return new Intl.DateTimeFormat(PRESENTATION_LOCALE, {
    timeZone: GUATEMALA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/** Relative age, e.g. "ahora", "hace 12 min", "hace 3 h", "hace 2 d". */
export function formatRelative(
  utc: string | number | Date | null | undefined,
  now: number = Date.now(),
): string {
  if (utc == null) return '—'
  const d = toDate(utc)
  if (!d) return '—'
  const diffMs = now - d.getTime()
  if (diffMs < 0) return 'ahora'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

/** Explicit "Última actualización: hace 12 min" style string with absolute fallback. */
export function formatLastUpdated(
  utc: string | number | Date | null | undefined,
  now: number = Date.now(),
): string {
  if (utc == null) return 'Última actualización: sin datos'
  const rel = formatRelative(utc, now)
  return `Última actualización: ${rel}`
}
