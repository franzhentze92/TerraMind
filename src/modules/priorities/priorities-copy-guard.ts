const FORBIDDEN_PATTERNS = [
  /incendio confirmado/i,
  /incendio forestal confirmado/i,
  /poblaci[oó]n en riesgo/i,
  /emergencia/i,
  /evacuaci[oó]n/i,
  /desastre/i,
  /respuesta inmediata oficial/i,
  /da[nñ]o confirmado/i,
  /impacto confirmado/i,
  /causa identificada/i,
]

export function containsForbiddenPriorityCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafePriorityCopy(text: string): void {
  if (containsForbiddenPriorityCopy(text)) {
    throw new Error(`Copy prohibido en prioridad: ${text.slice(0, 80)}`)
  }
}
