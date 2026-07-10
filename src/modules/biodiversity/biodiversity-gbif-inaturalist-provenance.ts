import { BIODIVERSITY_CONFIG } from './config/biodiversity.config'
import type { BiodiversityOccurrence } from './biodiversity.types'
import type { GbifOccurrenceRecord } from './providers/gbif/gbif.types'

const INAT_URL_RE = /inaturalist\.org\/observations\/(\d+)/i
const INAT_DATASET_TITLE_RE = /inaturalist/i

export interface GbifInaturalistProvenance {
  isFromInaturalist: boolean
  signals: string[]
  inaturalistObservationId?: string
}

/** Detecta procedencia iNaturalist en un registro GBIF sin implicar duplicado. */
export function detectGbifInaturalistProvenance(
  occ: BiodiversityOccurrence,
): GbifInaturalistProvenance {
  if (occ.source !== 'gbif') {
    return { isFromInaturalist: false, signals: [] }
  }

  const signals: string[] = []
  let inaturalistObservationId: string | undefined

  if (occ.sourceDatasetId === BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey) {
    signals.push('inat_gbif_dataset_key')
  }

  if (occ.datasetTitle && INAT_DATASET_TITLE_RE.test(occ.datasetTitle)) {
    signals.push('inat_dataset_title')
  }

  if (occ.publishingOrganization && INAT_DATASET_TITLE_RE.test(occ.publishingOrganization)) {
    signals.push('inat_publishing_organization')
  }

  const refId = extractInaturalistIdFromReferences(occ.sourceUrl)
  if (refId) {
    signals.push('inat_source_url')
    inaturalistObservationId = refId
  }

  if (occ.dwcOccurrenceId) {
    const fromOccId = extractInaturalistIdFromReferences(occ.dwcOccurrenceId)
    if (fromOccId) {
      signals.push('inat_occurrence_id')
      inaturalistObservationId = inaturalistObservationId ?? fromOccId
    } else if (/^\d+$/.test(occ.dwcOccurrenceId)) {
      signals.push('inat_numeric_occurrence_id')
      inaturalistObservationId = inaturalistObservationId ?? occ.dwcOccurrenceId
    }
  }

  if (occ.sourceReference && INAT_URL_RE.test(occ.sourceReference)) {
    signals.push('inat_source_reference')
    const ref = extractInaturalistIdFromReferences(occ.sourceReference)
    if (ref) inaturalistObservationId = inaturalistObservationId ?? ref
  }

  return {
    isFromInaturalist: signals.length > 0,
    signals,
    inaturalistObservationId,
  }
}

export function extractInaturalistIdFromReferences(value?: string): string | null {
  if (!value) return null
  const match = value.match(INAT_URL_RE)
  return match?.[1] ?? null
}

export function extractInaturalistIdFromGbifRecord(record: Pick<GbifOccurrenceRecord, 'references' | 'occurrenceID'>): string | null {
  const fromRef = record.references ? extractInaturalistIdFromReferences(record.references) : null
  if (fromRef) return fromRef
  if (record.occurrenceID) {
    const fromOcc = extractInaturalistIdFromReferences(record.occurrenceID)
    if (fromOcc) return fromOcc
    if (/^\d+$/.test(record.occurrenceID)) return record.occurrenceID
  }
  return null
}
