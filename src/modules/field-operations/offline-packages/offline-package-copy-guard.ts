const FORBIDDEN_COPY = [
  'incendio confirmado',
  'incendio activo confirmado',
  'extinción',
  'extinguido',
  'fuego controlado',
  'sin riesgo',
  'amenaza eliminada',
]

export function containsForbiddenOfflinePackageCopy(text: string): string | null {
  const lower = text.toLowerCase()
  for (const phrase of FORBIDDEN_COPY) {
    if (lower.includes(phrase)) return phrase
  }
  return null
}

export function assertSafeOfflinePackageCopy(text: string, field = 'copy'): void {
  const hit = containsForbiddenOfflinePackageCopy(text)
  if (hit) throw new Error(`Copy prohibido en ${field}: ${hit}`)
}

export function scanOfflinePackagePayloads(
  payloads: Array<{ path: string; content: string }>,
): string[] {
  const violations: string[] = []
  for (const payload of payloads) {
    const hit = containsForbiddenOfflinePackageCopy(payload.content)
    if (hit) violations.push(`${payload.path}:${hit}`)
  }
  return violations
}
