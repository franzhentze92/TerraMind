/**
 * Environmental Event Framework — canonical event model.
 *
 * Common fields live at the top level; every type-specific field is confined to
 * a strongly-typed `attributes` object selected by a discriminated union on
 * `eventType`. No `Record<string, unknown>` as a final contract.
 */
import type {
  DataClassification,
  EnvironmentalEventStatus,
  EnvironmentalEventType,
  EnvironmentalLifecycleState,
  EpistemicStatus,
} from '@/modules/environmental-events/types/taxonomy'

export interface EventTerritory {
  departmentCode: string | null
  departmentName: string | null
  crossDepartment?: boolean
}

export interface EventTrend {
  direction: 'rising' | 'stable' | 'falling'
  label: string
}

/**
 * Common shape for every environmental event. `TType` discriminates and
 * `TAttributes` carries type-specific evidence.
 */
export interface BaseEnvironmentalEvent<
  TType extends EnvironmentalEventType,
  TAttributes,
> {
  // Common — required
  id: string
  eventType: TType
  title: string
  status: EnvironmentalEventStatus
  epistemicStatus: EpistemicStatus
  classification: DataClassification
  geometry: GeoJSON.Geometry
  firstObservedAt: string
  lastObservedAt: string
  observationCount: number
  sourceIds: string[]
  sourceNames: string[]
  attributes: TAttributes
  createdAt: string
  updatedAt: string

  // Common — optional
  summary?: string
  lifecycleState?: EnvironmentalLifecycleState
  territory?: EventTerritory
  confidence?: number
  severity?: number
  persistence?: number
  area?: number
  trend?: EventTrend
  priorityAssessmentId?: string
  incidentId?: string
  findingIds?: string[]
  limitations?: string[]
  metadata?: Record<string, unknown>
}

/** Thermal-activity type-specific attributes (FIRMS-derived). */
export interface ThermalEventAttributes {
  detectionCount: number
  satelliteCount: number
  maxFrp?: number
  meanFrp?: number
  persistenceHours?: number
  sourceProducts?: string[]
  /** Legacy thermal enums preserved for adapters/parity (never rendered raw). */
  legacy: {
    status: string
    validationStatus: string
    riskLevel: string
    priorityScore: number
    geometryMethod: string | null
  }
}

/** Flood attributes — reserved, not registered. Kept for type completeness. */
export interface FloodEventAttributes {
  peakWaterLevelM?: number
  affectedAreaHa?: number
  returnPeriodYears?: number
}

/**
 * Synthetic test attributes — used ONLY by the framework self-test plugin.
 * Never enabled in runtime.
 */
export interface SyntheticEventAttributes {
  syntheticIndex: number
  note: string
}

// event:new:attributes (do not remove — anchor for the generator)

export type ThermalEnvironmentalEvent = BaseEnvironmentalEvent<
  'thermal_activity',
  ThermalEventAttributes
>

export type FloodEnvironmentalEvent = BaseEnvironmentalEvent<'flood', FloodEventAttributes>

export type SyntheticEnvironmentalEvent = BaseEnvironmentalEvent<
  'synthetic_framework_test',
  SyntheticEventAttributes
>

/** Discriminated union of all environmental events. */
export type EnvironmentalEvent =
  | ThermalEnvironmentalEvent
  | FloodEnvironmentalEvent
  | SyntheticEnvironmentalEvent
// event:new:event-union (do not remove — anchor for the generator)

/** A single presentation metric for an event (label + value + optional unit). */
export interface EventKeyMetric {
  key: string
  label: string
  value: string
  emphasis?: boolean
}

/** Query accepted by the generic events API / repository. */
export interface EnvironmentalEventQuery {
  type?: EnvironmentalEventType
  status?: EnvironmentalEventStatus
  lifecycle?: EnvironmentalLifecycleState
  classification?: DataClassification
  since?: string
  until?: string
  departmentCode?: string
  bounds?: [number, number, number, number]
  page?: number
  limit?: number
}

export interface EnvironmentalEventPage {
  items: EnvironmentalEvent[]
  pagination: { page: number; limit: number; total: number }
  generatedAt: string
}

/** Per-type summary used by Situación Nacional and dashboards. */
export interface EnvironmentalEventTypeSummary {
  type: EnvironmentalEventType
  label: string
  activeCount: number
  newCount?: number
  status?: string
}
