/**
 * CHIRPS v3 — pentad calendar utilities.
 *
 * CHIRPS uses 6 pentads per month; the 6th pentad covers the remaining 3–6 days.
 * We map calendar dates to pentad indices for seasonal comparison.
 */
export interface ChirpsPentadRef {
  year: number
  month: number
  /** 1–6 within the month. */
  pentad: number
  periodStart: string
  periodEnd: string
}

const MS_DAY = 86_400_000

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Days in month (non-leap simplification for pentad boundaries — leap handled at year level). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Pentad boundaries within a month (1-indexed month).
 * Pentads 1–5 are 5 days; pentad 6 is remainder.
 */
export function pentadDateRange(year: number, month: number, pentad: number): { start: Date; end: Date } {
  if (pentad < 1 || pentad > 6) throw new Error(`Pentad inválido: ${pentad}`)
  const dim = daysInMonth(year, month)
  const startDay = pentad <= 5 ? (pentad - 1) * 5 + 1 : 26
  const endDay = pentad <= 5 ? Math.min(pentad * 5, dim) : dim
  const start = new Date(Date.UTC(year, month - 1, startDay))
  const end = new Date(Date.UTC(year, month - 1, endDay, 23, 59, 59))
  return { start, end }
}

export function toPentadRef(year: number, month: number, pentad: number): ChirpsPentadRef {
  const { start, end } = pentadDateRange(year, month, pentad)
  return {
    year,
    month,
    pentad,
    periodStart: isoDate(start),
    periodEnd: isoDate(end),
  }
}

/** Map a UTC date to CHIRPS pentad within its month. */
export function dateToPentad(date: Date): ChirpsPentadRef {
  const year = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const day = date.getUTCDate()
  let pentad = Math.ceil(day / 5)
  if (pentad > 6) pentad = 6
  return toPentadRef(year, month, pentad)
}

/** List pentads covering the last N days ending at `end` (approximate via pentad steps). */
export function pentadsForWindow(end: Date, windowDays: number): ChirpsPentadRef[] {
  const refs: ChirpsPentadRef[] = []
  const seen = new Set<string>()
  let cursor = new Date(end.getTime())
  const startMs = end.getTime() - windowDays * MS_DAY
  while (cursor.getTime() >= startMs) {
    const ref = dateToPentad(cursor)
    const key = `${ref.year}-${ref.month}-${ref.pentad}`
    if (!seen.has(key)) {
      seen.add(key)
      refs.unshift(ref)
    }
    cursor = new Date(cursor.getTime() - 5 * MS_DAY)
  }
  return refs
}

/** Same pentad slots across baseline years for seasonal comparison. */
export function comparableBaselinePentads(
  refs: ChirpsPentadRef[],
  baselineStart: number,
  baselineEnd: number,
): ChirpsPentadRef[] {
  const out: ChirpsPentadRef[] = []
  for (const ref of refs) {
    for (let y = baselineStart; y <= baselineEnd; y++) {
      out.push(toPentadRef(y, ref.month, ref.pentad))
    }
  }
  return out
}

export function pentadFileName(ref: ChirpsPentadRef): string {
  const m = String(ref.month).padStart(2, '0')
  return `chirps-v3.0.${ref.year}.${m}.${ref.pentad}.tif`
}
