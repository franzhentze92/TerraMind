export function pluralizeEs(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function formatCountEs(
  count: number,
  singular: string,
  plural: string,
  atLeast = false,
): string {
  const word = pluralizeEs(count, singular, plural)
  return atLeast ? `al menos ${count} ${word}` : `${count} ${word}`
}
