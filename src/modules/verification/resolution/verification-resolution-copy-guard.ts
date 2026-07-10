const FORBIDDEN_PATTERNS = [
  /confirma incendio/i,
  /descarta incendio/i,
  /falso positivo confirmado/i,
  /extinci[oó]n/i,
  /poblaci[oó]n afectada/i,
  /emergencia/i,
  /propagaci[oó]n confirmada/i,
  /incendio confirmado/i,
  /incidente falso/i,
  /impacto confirmado/i,
]

export function containsForbiddenResolutionCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeResolutionCopy(text: string): void {
  if (containsForbiddenResolutionCopy(text)) {
    throw new Error(`Copy prohibido en resolución: ${text.slice(0, 80)}`)
  }
}
