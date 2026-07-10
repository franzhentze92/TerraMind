const FORBIDDEN_PATTERNS = [
  /incendio confirmado/i,
  /confirmar incendio/i,
  /extinguido/i,
  /emergencia/i,
  /poblaci[oó]n en riesgo/i,
  /propagaci[oó]n confirmada/i,
  /impacto confirmado/i,
  /afectaci[oó]n confirmada/i,
]

export function containsForbiddenVerificationCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeVerificationCopy(text: string): void {
  if (containsForbiddenVerificationCopy(text)) {
    throw new Error(`Copy prohibido en verificación: ${text.slice(0, 80)}`)
  }
}
