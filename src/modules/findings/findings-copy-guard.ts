const FORBIDDEN_PATTERNS = [
  /incendio forestal confirmado/i,
  /biodiversidad afectada/i,
  /poblaci[oó]n en riesgo/i,
  /da[nñ]o ambiental/i,
  /emergencia/i,
  /causa identificada/i,
  /especies afectadas/i,
  /no hay observaciones de inaturalist/i,
  /sin observaciones de inaturalist/i,
]

export function containsForbiddenFindingCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeFindingCopy(text: string): void {
  if (containsForbiddenFindingCopy(text)) {
    throw new Error(`Copy prohibido detectado: ${text.slice(0, 80)}`)
  }
}
