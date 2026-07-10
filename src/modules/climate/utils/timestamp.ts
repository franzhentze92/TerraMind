/** Convierte timestamps locales de Open-Meteo a ISO UTC usando utc_offset_seconds. */
export function openMeteoLocalTimeToUtc(
  localTime: string,
  utcOffsetSeconds: number | null | undefined,
): string {
  const offset = utcOffsetSeconds ?? 0
  const normalized = localTime.includes('T') ? localTime : `${localTime}T00:00:00`
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return new Date(normalized).toISOString()

  const [, y, m, d, hr, min] = match.map(Number)
  const utcMs = Date.UTC(y, m - 1, d, hr, min) - offset * 1000
  return new Date(utcMs).toISOString()
}

export function timestampToUtcMs(iso: string): number {
  return new Date(iso).getTime()
}

export function formatLocalPresentation(utcIso: string, timezone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(utcIso))
}
