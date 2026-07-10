const GT_TIMEZONE = 'America/Guatemala'

export function formatGuatemalaDateTime(isoUtc: string): string {
  return new Intl.DateTimeFormat('es-GT', {
    timeZone: GT_TIMEZONE,
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoUtc))
}

export function formatGuatemalaTime(isoUtc: string): string {
  return new Intl.DateTimeFormat('es-GT', {
    timeZone: GT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(isoUtc))
}

export function formatRelativeMinutes(isoUtc: string | null, now = Date.now()): string | null {
  if (!isoUtc) return null
  const diffMs = now - new Date(isoUtc).getTime()
  if (diffMs < 0) return 'ahora'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}

export function riskLevelLabel(risk: string): string {
  switch (risk) {
    case 'atencion':
      return 'Atención'
    case 'observacion':
      return 'Observación'
    case 'informativo':
      return 'Informativo'
    case 'alto':
      return 'Alto'
    case 'critico':
      return 'Crítico'
    default:
      return risk
  }
}

export function validationLabel(status: string): string {
  switch (status) {
    case 'confirmado':
      return 'Incendio confirmado'
    case 'probable':
      return 'Evento probable'
    case 'no_validado':
      return 'Evento térmico'
    default:
      return 'Evento térmico'
  }
}
