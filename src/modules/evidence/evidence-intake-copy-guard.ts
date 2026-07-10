const FORBIDDEN_PATTERNS = [
  /evidencia confirma incendio/i,
  /evidencia v[aá]lida/i,
  /incendio verificado/i,
  /afectaci[oó]n confirmada/i,
  /extinci[oó]n confirmada/i,
  /confirmar incendio/i,
  /incendio confirmado/i,
]

export function containsForbiddenEvidenceCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeEvidenceCopy(text: string): void {
  if (containsForbiddenEvidenceCopy(text)) {
    throw new Error(`Copy prohibido en evidencia: ${text.slice(0, 80)}`)
  }
}
