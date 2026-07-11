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

export function containsForbiddenResponseCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeResponseCopy(text: string): void {
  if (containsForbiddenResponseCopy(text)) {
    throw new Error(`Copy prohibido en respuesta: ${text.slice(0, 80)}`)
  }
}

export function assertSafeResponsePayload(payload: unknown): void {
  const texts = collectStrings(payload)
  for (const text of texts) {
    assertSafeResponseCopy(text)
  }
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => collectStrings(v, out))
  return out
}
