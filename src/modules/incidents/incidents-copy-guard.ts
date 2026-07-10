const FORBIDDEN_PATTERNS = [
  /incendio confirmado/i,
  /incendio forestal confirmado/i,
  /emergencia/i,
  /evacuaci[oó]n/i,
  /desastre/i,
  /propagaci[oó]n confirmada/i,
  /poblaci[oó]n afectada/i,
  /respuesta inmediata/i,
  /da[nñ]o confirmado/i,
  /impacto confirmado/i,
]

export function containsForbiddenIncidentCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeIncidentCopy(text: string): void {
  if (containsForbiddenIncidentCopy(text)) {
    throw new Error(`Copy prohibido en incidente: ${text.slice(0, 80)}`)
  }
}
