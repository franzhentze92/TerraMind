const GUATEMALA_TZ = 'America/Guatemala'

export function formatDateGt(iso: string | Date, style: 'short' | 'long' = 'long'): string {
  const date = iso instanceof Date ? iso : new Date(iso)
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: style,
    timeZone: GUATEMALA_TZ,
  }).format(date)
}

export function formatDateTimeGt(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso)
  return new Intl.DateTimeFormat('es-GT', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: GUATEMALA_TZ,
  }).format(date)
}

export function formatRelativeGt(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso)
  const diffMs = date.getTime() - Date.now()
  const absSec = Math.round(Math.abs(diffMs) / 1000)
  const rtf = new Intl.RelativeTimeFormat('es-GT', { numeric: 'auto' })
  if (absSec < 60) return rtf.format(Math.round(diffMs / 1000), 'second')
  if (absSec < 3600) return rtf.format(Math.round(diffMs / 60_000), 'minute')
  if (absSec < 86_400) return rtf.format(Math.round(diffMs / 3_600_000), 'hour')
  return rtf.format(Math.round(diffMs / 86_400_000), 'day')
}
