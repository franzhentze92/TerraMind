const FORBIDDEN_PATTERNS = [
  /confirma incendio/i,
  /descarta incendio/i,
  /falso positivo confirmado/i,
  /evento resuelto/i,
  /poblaci[oó]n afectada/i,
  /propagaci[oó]n confirmada/i,
  /incendio confirmado/i,
  /no hubo incendio/i,
  /evento inexistente/i,
]

export function containsForbiddenValidationCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeValidationCopy(text: string): void {
  if (containsForbiddenValidationCopy(text)) {
    throw new Error(`Copy prohibido en validación: ${text.slice(0, 80)}`)
  }
}
