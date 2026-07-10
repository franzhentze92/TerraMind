import { createHash } from 'node:crypto'
import type { BiodiversityProviderId, BiodiversitySearchQuery } from '../biodiversity.types'

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'object') return String(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${k}:${stableStringify(obj[k])}`).join(',')}}`
}

export function buildBiodiversityQueryHash(
  provider: BiodiversityProviderId,
  query: BiodiversitySearchQuery,
  pageKey?: string,
): string {
  const payload = {
    provider,
    geometry: query.geometry ?? null,
    latitude: query.latitude ?? null,
    longitude: query.longitude ?? null,
    radiusM: query.radiusM ?? null,
    observedFrom: query.observedFrom ?? null,
    observedTo: query.observedTo ?? null,
    taxonId: query.taxonId ?? null,
    scientificName: query.scientificName ?? null,
    qualityFilters: query.qualityFilters ?? null,
    limit: query.limit ?? null,
    cursor: query.cursor ?? null,
    pageKey: pageKey ?? null,
  }
  return createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 24)
}
