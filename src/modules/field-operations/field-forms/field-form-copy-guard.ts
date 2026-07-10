const FORBIDDEN_OUTPUT = [
  'incendio confirmado',
  'incendio activo confirmado',
  'extinción',
  'extinguido',
  'fuego controlado',
  'sin riesgo',
  'amenaza eliminada',
  'ausencia confirmada',
  'no hay incendio',
]

export function containsForbiddenFieldFormCopy(text: string): string | null {
  const lower = text.toLowerCase()
  for (const phrase of FORBIDDEN_OUTPUT) {
    if (lower.includes(phrase)) return phrase
  }
  return null
}

export function scanAnswersForForbiddenCopy(answers: Record<string, unknown>): string[] {
  const violations: string[] = []
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') {
      const hit = containsForbiddenFieldFormCopy(value)
      if (hit) violations.push(`${path}:${hit}`)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, path ? `${path}.${k}` : k)
      }
    }
  }
  walk(answers, '')
  return violations
}

export function sanitizeTextInput(value: string, maxLength = 5000): string {
  return value
    .replace(/<[^>]*>/g, '')
    .slice(0, maxLength)
    .trim()
}
