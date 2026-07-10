const FORBIDDEN = [
  'incendio confirmado',
  'extinción',
  'extinguido',
  'evidencia aceptada',
  'requirement satisfied',
  'verificado',
]

export function containsForbiddenEvidenceCopy(text: string): string | null {
  const lower = text.toLowerCase()
  for (const phrase of FORBIDDEN) {
    if (lower.includes(phrase)) return phrase
  }
  return null
}

export function scanNoteText(note: string): string | null {
  return containsForbiddenEvidenceCopy(note)
}
