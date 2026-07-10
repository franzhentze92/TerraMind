export type GbifBasisOfRecord =
  | 'OBSERVATION'
  | 'HUMAN_OBSERVATION'
  | 'MACHINE_OBSERVATION'
  | 'PRESERVED_SPECIMEN'
  | 'FOSSIL_SPECIMEN'
  | 'MATERIAL_SAMPLE'
  | 'LIVING_SPECIMEN'
  | 'OCCURRENCE'
  | string

export interface GbifOccurrenceRecord {
  key: number
  datasetKey?: string
  publishingOrgKey?: string
  occurrenceID?: string
  taxonKey?: number
  speciesKey?: number
  scientificName?: string
  canonicalName?: string
  vernacularName?: string
  taxonRank?: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  species?: string
  eventDate?: string
  day?: number
  month?: number
  year?: number
  decimalLatitude?: number
  decimalLongitude?: number
  coordinateUncertaintyInMeters?: number
  geodeticDatum?: string
  basisOfRecord?: GbifBasisOfRecord
  occurrenceStatus?: string
  establishmentMeans?: string
  license?: string
  rightsHolder?: string
  recordedBy?: string
  institutionCode?: string
  collectionCode?: string
  catalogNumber?: string
  datasetName?: string
  publishingOrg?: string
  issues?: string[]
  references?: string
  media?: Array<{ identifier?: string; type?: string }>
  individualCount?: number
  organismQuantity?: string
  degreeOfEstablishment?: string
  georeferenceProtocol?: string
  hasCoordinate?: boolean
  hasGeospatialIssue?: boolean
  lastInterpreted?: string
  identifiedBy?: string
  identificationVerificationStatus?: string
}

export interface GbifOccurrenceSearchResponse {
  offset: number
  limit: number
  endOfRecords: boolean
  count: number
  results: GbifOccurrenceRecord[]
}

export interface GbifSpeciesMatchResponse {
  usageKey?: number
  scientificName?: string
  canonicalName?: string
  rank?: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  species?: string
  confidence?: number
  matchType?: string
  status?: string
  synonym?: boolean
  vernacularName?: string
}

export interface GbifSpeciesRecord {
  key: number
  scientificName: string
  canonicalName?: string
  rank?: string
  kingdom?: string
  phylum?: string
  class?: string
  order?: string
  family?: string
  genus?: string
  species?: string
  vernacularNames?: Array<{ vernacularName: string; language?: string }>
}

export class GbifApiError extends Error {
  readonly code: 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK' | 'RATE_LIMIT' | 'PARSE_ERROR'
  readonly status?: number

  constructor(code: GbifApiError['code'], message: string, status?: number) {
    super(message)
    this.name = 'GbifApiError'
    this.code = code
    this.status = status
  }
}
