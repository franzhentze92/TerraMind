const marks = new Map<string, number>()
let startMs = typeof performance !== 'undefined' ? performance.now() : 0

export function resetSituationPerformance(): void {
  marks.clear()
  startMs = typeof performance !== 'undefined' ? performance.now() : 0
}

export function markSituationPerformance(label: string): void {
  if (typeof performance === 'undefined') return
  if (!marks.has(label)) {
    marks.set(label, performance.now() - startMs)
  }
}

export function getSituationPerformanceMarks(): Record<string, number> {
  return Object.fromEntries(marks.entries())
}

export function getSituationInitialRequestCount(): number {
  return 3
}
