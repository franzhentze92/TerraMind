const FORBIDDEN_PATTERNS = [
  /apagar incendio/i,
  /confirmar incendio/i,
  /responder a emergencia/i,
  /evacuar/i,
  /poblaci[oó]n afectada/i,
  /controlar propagaci[oó]n/i,
  /extinguido/i,
  /emergencia/i,
]

export function containsForbiddenMissionCopy(text: string): boolean {
  return FORBIDDEN_PATTERNS.some((re) => re.test(text))
}

export function assertSafeMissionCopy(text: string): void {
  if (containsForbiddenMissionCopy(text)) {
    throw new Error(`Copy prohibido en misión: ${text.slice(0, 80)}`)
  }
}
