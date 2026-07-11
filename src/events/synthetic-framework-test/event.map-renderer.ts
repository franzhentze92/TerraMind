/** Synthetic framework test plugin — polygon map renderer. */
import type {
  EnvironmentalEventMapRenderer,
  EventLegendDefinition,
  EventMapLayerDefinition,
  EventMapPopupModel,
} from '@/modules/environmental-events/contracts/map-renderer'
import type { EnvironmentalGeometryKind } from '@/modules/environmental-events/types/taxonomy'
import type { SyntheticEnvironmentalEvent } from './event.types'

export class SyntheticMapRenderer
  implements EnvironmentalEventMapRenderer<SyntheticEnvironmentalEvent>
{
  readonly eventType = 'synthetic_framework_test' as const
  readonly supportedGeometryKinds: EnvironmentalGeometryKind[] = ['polygon', 'multipolygon']

  toMapFeature(event: SyntheticEnvironmentalEvent): GeoJSON.Feature {
    return {
      type: 'Feature',
      geometry: event.geometry,
      properties: {
        id: event.id,
        event_type: event.eventType,
        title: event.title,
      },
    }
  }

  getLayerDefinition(): EventMapLayerDefinition {
    return { id: 'synthetic_polygons', kind: 'polygon', clustered: false }
  }

  getLegendDefinition(): EventLegendDefinition {
    return {
      title: 'Evento sintético (prueba)',
      groups: [
        {
          title: 'Prueba',
          items: [{ label: 'Polígono sintético', color: '#888888', shape: 'disc' }],
        },
      ],
    }
  }

  getPopupModel(event: SyntheticEnvironmentalEvent): EventMapPopupModel {
    return {
      title: event.title,
      rows: [{ label: 'Índice', value: String(event.attributes.syntheticIndex) }],
      disclaimer: 'Evento de prueba; sin validez científica.',
    }
  }

  supportsGeometry(geometry: GeoJSON.Geometry): boolean {
    return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
  }
}

export const syntheticMapRenderer = new SyntheticMapRenderer()
