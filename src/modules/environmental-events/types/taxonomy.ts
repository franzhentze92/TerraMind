/**
 * Environmental Event Framework — shared taxonomies.
 *
 * Central, canonical enums for every environmental event type. No adapter or
 * module may invent parallel variants; thermal legacy values are mapped onto
 * these via adapters (see thermal-event.mapper.ts).
 */
import type { DataClassification } from '@/modules/executive-metrics/metric-taxonomy'

export type { DataClassification } from '@/modules/executive-metrics/metric-taxonomy'

/**
 * Canonical event types. `flood` is reserved but NOT registered yet.
 * `synthetic_framework_test` is a test-only type (never enabled in runtime);
 * it exists to prove the framework auto-detects new plugins end to end.
 */
export type EnvironmentalEventType =
  | 'thermal_activity'
  | 'flood'
  | 'synthetic_framework_test'
// event:new:union (do not remove — anchor for the generator)

/** The only event types active (registered) in this foundation block. */
export const ACTIVE_EVENT_TYPES: readonly EnvironmentalEventType[] = [
  'thermal_activity',
] as const

/** Reserved-but-not-implemented event types (documentation / future work). */
export const RESERVED_EVENT_TYPES: readonly EnvironmentalEventType[] = ['flood'] as const

/** Operational status of an environmental event. */
export type EnvironmentalEventStatus =
  | 'detected'
  | 'active'
  | 'monitoring'
  | 'resolved'
  | 'archived'

export const ENVIRONMENTAL_EVENT_STATUSES: readonly EnvironmentalEventStatus[] = [
  'detected',
  'active',
  'monitoring',
  'resolved',
  'archived',
] as const

/** Lifecycle stage of an environmental event. */
export type EnvironmentalLifecycleState =
  | 'emerging'
  | 'expanding'
  | 'persistent'
  | 'declining'
  | 'ended'

export const ENVIRONMENTAL_LIFECYCLE_STATES: readonly EnvironmentalLifecycleState[] = [
  'emerging',
  'expanding',
  'persistent',
  'declining',
  'ended',
] as const

/** Epistemic position of an event along the intelligence chain. */
export type EpistemicStatus =
  | 'observed'
  | 'inferred'
  | 'reported'
  | 'verified'
  | 'recommended'
  | 'decided'
  | 'executed'

export const EPISTEMIC_STATUSES: readonly EpistemicStatus[] = [
  'observed',
  'inferred',
  'reported',
  'verified',
  'recommended',
  'decided',
  'executed',
] as const

/** Geometry kinds an event type may declare support for. */
export type EnvironmentalGeometryKind =
  | 'point'
  | 'multipoint'
  | 'line'
  | 'polygon'
  | 'multipolygon'
  | 'raster_reference'
  | 'administrative_area'

export const ENVIRONMENTAL_GEOMETRY_KINDS: readonly EnvironmentalGeometryKind[] = [
  'point',
  'multipoint',
  'line',
  'polygon',
  'multipolygon',
  'raster_reference',
  'administrative_area',
] as const

export function isEnvironmentalEventType(v: string): v is EnvironmentalEventType {
  return (
    v === 'thermal_activity' ||
    v === 'flood' ||
    v === 'synthetic_framework_test' ||
    // event:new:guard (do not remove — anchor for the generator)
    false
  )
}

export function isEnvironmentalEventStatus(v: string): v is EnvironmentalEventStatus {
  return (ENVIRONMENTAL_EVENT_STATUSES as readonly string[]).includes(v)
}

/** Classification stays canonical (Phase 1). Re-exported for convenience. */
export const DEFAULT_CLASSIFICATION: DataClassification = 'operational'
