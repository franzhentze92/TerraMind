/**
 * Environmental Event Framework — map renderer contract.
 *
 * Produces data models (feature, layer, legend, popup) rather than React nodes,
 * so existing map components keep working while new types plug in. The contract
 * supports polygons for future flood rendering; the thermal renderer only
 * declares point support.
 */
import type {
  EnvironmentalEventType,
  EnvironmentalGeometryKind,
} from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

export interface EventMapLayerDefinition {
  id: string
  kind: 'point' | 'cluster' | 'polygon' | 'line'
  clustered: boolean
  colorField?: string
}

export interface EventLegendItem {
  label: string
  color: string
  shape: 'disc' | 'ring' | 'dot' | 'line'
}

export interface EventLegendDefinition {
  title: string
  groups: Array<{ title: string; items: EventLegendItem[] }>
}

export interface EventMapPopupModel {
  title: string
  rows: Array<{ label: string; value: string }>
  disclaimer?: string
}

export interface EnvironmentalEventMapRenderer<
  TEvent extends EnvironmentalEvent = EnvironmentalEvent,
> {
  eventType: EnvironmentalEventType
  supportedGeometryKinds: EnvironmentalGeometryKind[]

  toMapFeature(event: TEvent): GeoJSON.Feature
  getLayerDefinition(): EventMapLayerDefinition
  getLegendDefinition(): EventLegendDefinition
  getPopupModel(event: TEvent): EventMapPopupModel
  supportsGeometry(geometry: GeoJSON.Geometry): boolean
}
