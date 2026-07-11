/**
 * Rainfall deficit — typed domain model (CHIRPS v3 pentadal MVP).
 */
export type ChirpsProductStatus = 'preliminary' | 'final'

export type RainfallDeficitTimestep = 'pentad'

export interface RainfallWindowMetrics {
  analysisWindowDays: number
  analysisWindowPentads: number
  observedRainfallMm: number
  expectedRainfallMm?: number
  absoluteDeficitMm?: number
  relativeDeficitPercent?: number
  historicalPercentile?: number
  standardizedAnomaly?: number
  historicalSampleYears?: number
}

export interface RainfallDeficitEventAttributes {
  /** Ventana canónica del evento (30 días / 6 pentadas en MVP). */
  canonicalWindowDays: number
  windows: {
    days15?: RainfallWindowMetrics
    days30: RainfallWindowMetrics
    days60?: RainfallWindowMetrics
  }

  consecutiveDeficitPentads: number
  persistenceDays: number

  affectedAreaKm2: number
  affectedCellCount: number
  municipalityCount?: number
  departmentCount?: number
  municipalityNames?: string[]

  croplandOverlapKm2?: number
  ruralPopulationPotentiallyExposed?: number
  dryCorridorOverlapKm2?: number

  currentProductStatus: ChirpsProductStatus
  sourceVersion: string
  timestep: RainfallDeficitTimestep
  processingVersion: string
  baselineStartYear: number
  baselineEndYear: number

  missingCellPercent?: number
  terrainComplexityFlag?: boolean
  qualityFlags: string[]

  /** Resolución CHIRPS declarada (aprox.). */
  gridResolutionDegrees: number

  /** Intensidad operativa derivada de umbrales configurables. */
  intensityClass: 'moderate' | 'elevated' | 'severe' | 'recovering'

  /** Trazabilidad de la última decisión de detección. */
  lastDecisionId?: string
}

export interface RainfallDeficitDetectionRuleResult {
  ruleId: string
  satisfied: boolean
  value?: number | string
  threshold?: number | string
}

/** Decisión auditable por celda o cluster. */
export interface RainfallDeficitDetectionDecision {
  id: string
  algorithmVersion: string
  evaluatedAt: string
  cellId?: string
  clusterId?: string
  satisfiedRules: RainfallDeficitDetectionRuleResult[]
  unsatisfiedRules: RainfallDeficitDetectionRuleResult[]
  isCandidate: boolean
  rationale: string
}

/** Observación normalizada por celda CHIRPS (pre-detección). */
export interface ChirpsPentadObservationAttributes {
  precipitationMm: number
  pentadYear: number
  pentadMonth: number
  pentadIndex: number
  periodStart: string
  periodEnd: string
  productStatus: ChirpsProductStatus
  sourceVersion: string
  variant: 'preliminary' | 'final'
  processingVersion: string
  checksum?: string
  originUrl: string
  qualityFlags: string[]
}

export type RainfallDeficitEnvironmentalEvent = import('@/modules/environmental-events/types/environmental-event.types').BaseEnvironmentalEvent<
  'rainfall_deficit',
  RainfallDeficitEventAttributes
>
