/**
 * Spanish-aware count formatting so raw "N item(s)" patterns never reach the UI.
 *
 * `pluralizeCount` builds "N singular" / "N plural" and lets callers provide a
 * dedicated zero phrase (e.g. "Sin preguntas activas") instead of "0 pregunta(s)".
 */
export function pluralizeCount(
  count: number,
  singular: string,
  plural: string,
  options: { zero?: string; includeCount?: boolean } = {},
): string {
  const { zero, includeCount = true } = options
  if (count === 0 && zero != null) return zero
  const noun = count === 1 ? singular : plural
  return includeCount ? `${count} ${noun}` : noun
}

/** "Sin preguntas activas" | "1 pregunta activa" | "N preguntas activas". */
export function activeQuestionsLabel(count: number): string {
  return pluralizeCount(count, 'pregunta activa', 'preguntas activas', {
    zero: 'Sin preguntas activas',
  })
}
