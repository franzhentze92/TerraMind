/** Proveedores de datos de biodiversidad soportados por TerraMind. */
export type BiodiversityProviderId = 'gbif' | 'inaturalist'

/** Semántica normalizada del tipo de registro biológico. */
export type BiodiversityRecordKind =
  | 'citizen_science_observation'
  | 'human_observation'
  | 'machine_observation'
  | 'preserved_specimen'
  | 'collection_record'
  | 'historical_presence'
  | 'recent_observation'

/** Nivel de privacidad aplicado a una ocurrencia. */
export type BiodiversityPrivacyLevel =
  | 'public_exact'
  | 'public_generalized'
  | 'sensitive_generalized'
  | 'private_unavailable'

/** Filtros de calidad opcionales para búsquedas. */
export interface BiodiversityQualityFilters {
  /** Excluir registros en cautiverio o cultivo. */
  excludeCaptiveCultivated?: boolean
  /** Solo registros con coordenadas. */
  requireCoordinates?: boolean
  /** Solo research grade (iNaturalist) o equivalente. */
  researchGradeOnly?: boolean
  /** Excluir registros con issues geoespaciales (GBIF). */
  excludeGeospatialIssues?: boolean
}

/** Consulta normalizada independiente del proveedor. */
export interface BiodiversitySearchQuery {
  latitude?: number
  longitude?: number
  /** Radio en metros alrededor de lat/lng. */
  radiusM?: number
  /** Geometría WKT simple (Point, Polygon). Complejidad limitada. */
  geometry?: string
  observedFrom?: string
  observedTo?: string
  taxonId?: string
  scientificName?: string
  qualityFilters?: BiodiversityQualityFilters
  providers?: BiodiversityProviderId[]
  limit?: number
  cursor?: string
  mode?: 'summary' | 'detail'
}

/** Taxón normalizado. */
export interface BiodiversityTaxon {
  source: BiodiversityProviderId
  sourceTaxonId: string
  scientificName: string
  canonicalName?: string
  commonName?: string
  taxonRank?: string
  kingdom?: string
  phylum?: string
  className?: string
  orderName?: string
  family?: string
  genus?: string
  species?: string
  matchType?: string
  confidence?: number
  sourceUrl: string
  fetchedAt: string
}

/** Ocurrencia normalizada. */
export interface BiodiversityOccurrence {
  source: BiodiversityProviderId
  sourceOccurrenceId: string
  sourceDatasetId?: string
  sourceTaxonId?: string
  scientificName: string
  canonicalName?: string
  commonName?: string
  taxonRank?: string
  kingdom?: string
  phylum?: string
  className?: string
  orderName?: string
  family?: string
  genus?: string
  species?: string
  observedAt?: string
  eventDatePrecision?: string
  latitude?: number
  longitude?: number
  coordinateUncertaintyM?: number
  coordinatesObscured: boolean
  geoprivacy?: string
  privacyLevel: BiodiversityPrivacyLevel
  qualityGrade?: string
  basisOfRecord?: string
  occurrenceStatus?: string
  captiveOrCultivated?: boolean
  establishmentMeans?: string
  license?: string
  attribution?: string
  sourceUrl: string
  datasetTitle?: string
  publishingOrganization?: string
  recordKind: BiodiversityRecordKind
  possibleDuplicate: boolean
  duplicateGroupId?: string
  deduplicationReason?: string
  fetchedAt: string
  qualityWarnings: string[]
}

/** Resultado paginado de búsqueda. */
export interface BiodiversitySearchResult {
  occurrences: BiodiversityOccurrence[]
  nextCursor?: string
  totalEstimate?: number
  provider: BiodiversityProviderId
  queryHash: string
  fetchedAt: string
  truncated: boolean
  disclaimer: string
}

/** Entrada para resolución taxonómica. */
export interface BiodiversityTaxonResolveInput {
  scientificName?: string
  taxonId?: string
  provider?: BiodiversityProviderId
}

/** Métricas de calidad agregadas. */
export interface BiodiversityDataQuality {
  provider: BiodiversityProviderId
  recordsCount: number
  coordinateCompletenessPct: number
  dateCompletenessPct: number
  taxonResolutionPct: number
  researchGradePct?: number
  obscuredCount: number
  captiveCount: number
  unknownLicenseCount: number
  possibleDuplicateCount: number
  warnings: string[]
}

/** Estado de salud del subsistema. */
export interface BiodiversitySystemHealth {
  gbif_reachable: boolean
  inaturalist_reachable: boolean
  database_reachable: boolean
  cache_status: 'warm' | 'cold' | 'disabled'
  last_success_by_provider: Partial<Record<BiodiversityProviderId, string | null>>
  consecutive_failures: Partial<Record<BiodiversityProviderId, number>>
  rate_limit_state: Partial<Record<BiodiversityProviderId, 'ok' | 'throttled' | 'unknown'>>
  generated_at: string
}

/** Salud de un proveedor individual. */
export interface BiodiversityProviderHealth {
  provider: BiodiversityProviderId
  reachable: boolean
  latencyMs?: number
  rateLimitState: 'ok' | 'throttled' | 'unknown'
  message?: string
  checkedAt: string
}

/** Resultado combinado de búsqueda multi-proveedor. */
export interface BiodiversityCombinedSearchResult {
  items: BiodiversityOccurrence[]
  byProvider: Partial<Record<BiodiversityProviderId, BiodiversitySearchResult>>
  quality: BiodiversityDataQuality[]
  nextCursor?: string
  deduplicatedCount: number
  generatedAt: string
  disclaimer: string
}
