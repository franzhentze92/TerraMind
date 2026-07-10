import { createHash } from 'node:crypto'
import type { BiodiversityOccurrence } from './biodiversity.types'
import { BIODIVERSITY_CONFIG } from './config/biodiversity.config'
import { extractInaturalistIdFromGbif } from './providers/gbif/gbif.mapper'

export type DeduplicationReason =
  | 'shared_identifier'
  | 'occurrence_id'
  | 'inat_url_in_gbif'
  | 'taxon_date_location'
  | 'none'

function generalizeKey(lat?: number, lng?: number): string {
  if (lat === undefined || lng === undefined) return 'no-coords'
  return `${lat.toFixed(2)},${lng.toFixed(2)}`
}

function dateKey(iso?: string): string {
  if (!iso) return 'no-date'
  return iso.slice(0, 10)
}

function buildGroupId(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 16)
}

/**
 * Deduplicación conservadora entre GBIF e iNaturalist.
 * No elimina registros dudosos; solo marca possibleDuplicate.
 */
export function markBiodiversityDuplicates(
  occurrences: BiodiversityOccurrence[],
): BiodiversityOccurrence[] {
  const inatById = new Map<string, BiodiversityOccurrence>()
  const gbifByInatId = new Map<string, BiodiversityOccurrence[]>()
  const marked = occurrences.map((o) => ({ ...o }))

  for (const occ of marked) {
    if (occ.source === 'inaturalist') {
      inatById.set(occ.sourceOccurrenceId, occ)
    }
  }

  for (const occ of marked) {
    if (occ.source !== 'gbif') continue
    const inatId = extractInaturalistIdFromGbif({
      key: Number(occ.sourceOccurrenceId),
      references: occ.sourceUrl,
      datasetKey: occ.sourceDatasetId,
    } as never)
    if (!inatId) continue
    const list = gbifByInatId.get(inatId) ?? []
    list.push(occ)
    gbifByInatId.set(inatId, list)
  }

  const groups = new Map<string, string>()

  for (const occ of marked) {
  // A. identificador compartido explícito (inat id en GBIF)
    if (occ.source === 'gbif') {
      const inatId = extractInaturalistIdFromGbif({
        key: Number(occ.sourceOccurrenceId),
        references: occ.sourceUrl,
        datasetKey: occ.sourceDatasetId,
      } as never)
      if (inatId && inatById.has(inatId)) {
        const groupId = buildGroupId(['inat-id', inatId])
        groups.set(`${occ.source}:${occ.sourceOccurrenceId}`, groupId)
        const inatOcc = inatById.get(inatId)!
        groups.set(`${inatOcc.source}:${inatOcc.sourceOccurrenceId}`, groupId)
      }
    }

    if (
      occ.sourceDatasetId === BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey &&
      occ.source === 'gbif'
    ) {
      const groupId = buildGroupId(['gbif-inat-dataset', occ.sourceOccurrenceId])
      groups.set(`${occ.source}:${occ.sourceOccurrenceId}`, groupId)
    }
  }

  // D. taxón + fecha + coordenada generalizada
  const fuzzyIndex = new Map<string, BiodiversityOccurrence[]>()
  for (const occ of marked) {
    const key = [
      occ.scientificName.toLowerCase(),
      dateKey(occ.observedAt),
      generalizeKey(occ.latitude, occ.longitude),
      occ.source,
    ].join('|')
    const list = fuzzyIndex.get(key) ?? []
    list.push(occ)
    fuzzyIndex.set(key, list)
  }

  for (const [, list] of fuzzyIndex) {
    if (list.length < 2) continue
    const sources = new Set(list.map((o) => o.source))
    if (!sources.has('gbif') || !sources.has('inaturalist')) continue
    const groupId = buildGroupId([
      'fuzzy',
      list[0]!.scientificName,
      dateKey(list[0]!.observedAt),
      generalizeKey(list[0]!.latitude, list[0]!.longitude),
    ])
    for (const occ of list) {
      if (!groups.has(`${occ.source}:${occ.sourceOccurrenceId}`)) {
        groups.set(`${occ.source}:${occ.sourceOccurrenceId}`, groupId)
      }
    }
  }

  return marked.map((occ) => {
    const groupId = groups.get(`${occ.source}:${occ.sourceOccurrenceId}`)
    if (!groupId) return occ

    let reason: DeduplicationReason = 'taxon_date_location'
    if (occ.source === 'gbif' && extractInaturalistIdFromGbif({
      key: Number(occ.sourceOccurrenceId),
      references: occ.sourceUrl,
      datasetKey: occ.sourceDatasetId,
    } as never)) {
      reason = 'inat_url_in_gbif'
    }
    if (occ.sourceDatasetId === BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey) {
      reason = 'shared_identifier'
    }

    return {
      ...occ,
      possibleDuplicate: true,
      duplicateGroupId: groupId,
      deduplicationReason: reason,
      qualityWarnings: [...occ.qualityWarnings, `possible_duplicate:${reason}`],
    }
  })
}

export function countPossibleDuplicates(occurrences: BiodiversityOccurrence[]): number {
  return occurrences.filter((o) => o.possibleDuplicate).length
}
