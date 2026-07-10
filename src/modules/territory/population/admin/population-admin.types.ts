export type AdminStatisticType = 'census' | 'projection'
export type TemporalAlignment = 'exact' | 'partial' | 'nearest' | 'mismatch'

export interface AdminPopulationRecord {
  adminLevel: 'national' | 'department' | 'municipality'
  adminCode: string
  departmentCode?: string
  municipalityCode?: string
  adminName: string
  statisticType: AdminStatisticType
  referenceYear: number
  populationTotal: number
  populationUrban?: number
  populationRural?: number
  households?: number
  isCensus: boolean
  isProjection: boolean
  temporalAlignment: TemporalAlignment
  source: string
  projectionMethod?: string
}

export interface SettlementRecord {
  sourceSettlementId: string
  name: string
  normalizedName: string
  settlementType: string
  departmentCode?: string
  municipalityCode?: string
  departmentName?: string
  municipalityName?: string
  lat: number
  lon: number
  populationReference?: number
  populationReferenceYear?: number
  locationAccuracy: string
  source: string
}

export interface AdminRasterComparison {
  adminLevel: 'national' | 'department' | 'municipality'
  adminCode: string
  adminName: string
  officialPopulation: number
  officialReferenceYear: number
  statisticType: AdminStatisticType
  rasterConstrainedSum?: number
  rasterUnconstrainedSum?: number
  absoluteDifferenceConstrained?: number
  percentageDifferenceConstrained?: number
  absoluteDifferenceUnconstrained?: number
  percentageDifferenceUnconstrained?: number
  temporalAlignment: TemporalAlignment
  coveragePct?: number
  interpretation: string
}

export interface IneImportDryRunReport {
  mode: 'dry-run' | 'apply'
  sources: number
  adminStatistics: {
    inserted: number
    updated: number
    unchanged: number
    rejected: number
    duplicates: number
  }
  crosswalk: { inserted: number }
  settlements: { inserted: number; rejected: number }
  warnings: string[]
  checksum: string
}
