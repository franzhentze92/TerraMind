const FORBIDDEN_PATTERNS = [
  /incendio confirmado/i,
  /emergencia/i,
  /desastre/i,
  /personas afectadas/i,
  /propagaci[oó]n confirmada/i,
  /da[nñ]os confirmados/i,
  /causa confirmada/i,
  /evacuaci[oó]n/i,
  /controlado/i,
  /extinguido/i,
  /fuego confirmado/i,
]

export function containsForbiddenExecutiveCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeExecutiveCopy(text: string): void {
  if (containsForbiddenExecutiveCopy(text)) {
    throw new Error(`Copy prohibido en informe ejecutivo: ${text.slice(0, 80)}`)
  }
}

export function assertSafeExecutivePayload(payload: unknown): void {
  for (const text of collectStrings(payload)) {
    assertSafeExecutiveCopy(text)
  }
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => collectStrings(v, out))
  return out
}
