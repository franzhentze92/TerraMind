/**
 * Environmental Event Framework — observation contracts.
 *
 * Observations are the raw/normalized inputs a source adapter provides before
 * detection groups them into events. Physical storage remains per-source
 * (fire_detections etc.); adapters wrap those stores, they do not replace them.
 */
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'

export interface EnvironmentalObservation<
  TType extends EnvironmentalEventType,
  TAttributes,
> {
  id: string
  eventType: TType
  sourceAdapterId: string
  sourceObservationId?: string
  observedAt: string
  receivedAt?: string
  geometry: GeoJSON.Geometry
  confidence?: number
  attributes: TAttributes
  rawReference?: string
}

/** Thermal observation attributes (a single FIRMS detection). */
export interface ThermalObservationAttributes {
  frp?: number
  brightness?: number
  satellite?: string
  instrument?: string
  confidenceLabel?: string
  dayNight?: string
}

export type ThermalObservation = EnvironmentalObservation<
  'thermal_activity',
  ThermalObservationAttributes
>

export interface ObservationFetchRequest {
  since?: string
  until?: string
  bounds?: [number, number, number, number]
  dryRun?: boolean
}

export interface ObservationNormalizationContext {
  now?: Date
}

export interface ObservationSourceHealth {
  id: string
  label: string
  healthy: boolean
  lastSuccessAt: string | null
  providersExpected: number
  providersOperational: number
  detail?: string
}

/**
 * Wraps an external observation provider (e.g. NASA FIRMS). Concrete adapters
 * must not rewrite the existing ingestion; they delegate to it.
 */
export interface ObservationSourceAdapter<TRaw, TNormalized> {
  id: string
  label: string
  supportedEventTypes: EnvironmentalEventType[]

  fetch(request: ObservationFetchRequest): Promise<TRaw[]>
  normalize(
    raw: TRaw[],
    context: ObservationNormalizationContext,
  ): Promise<TNormalized[]>
  getHealth(): Promise<ObservationSourceHealth>
}

/** Lightweight, bundle-safe descriptor of a source used inside the registry. */
export interface ObservationSourceDescriptor {
  id: string
  label: string
  supportedEventTypes: EnvironmentalEventType[]
  providerNames: string[]
}
