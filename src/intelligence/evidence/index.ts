import type { Evidence } from '@/intelligence/types'

export function validateEvidenceChain(evidence: Evidence[]): boolean {
  return evidence.length > 0 && evidence.every((e) => e.source && e.timestamp && e.rawReference)
}

export function groupEvidenceBySource(evidence: Evidence[]): Record<string, Evidence[]> {
  return evidence.reduce<Record<string, Evidence[]>>((acc, item) => {
    const key = item.source
    if (!acc[key]) acc[key] = []
    acc[key].push(item)
    return acc
  }, {})
}
