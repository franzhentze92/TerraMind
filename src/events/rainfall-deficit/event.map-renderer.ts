/** Déficit de precipitación — polygon map renderer. */
import type { EnvironmentalEventMapRenderer } from '@/modules/environmental-events/contracts/map-renderer'
import type {
  EventLegendDefinition,
  EventMapLayerDefinition,
  EventMapPopupModel,
} from '@/modules/environmental-events/contracts/map-renderer'
import type { EnvironmentalGeometryKind } from '@/modules/environmental-events/types/taxonomy'
import type { RainfallDeficitEnvironmentalEvent } from './event.types'

const INTENSITY_COLORS = {
  moderate: '#fbbf24',
  elevated: '#f97316',
  severe: '#dc2626',
  recovering: '#22c55e',
} as const

export class RainfallDeficitMapRenderer
  implements EnvironmentalEventMapRenderer<RainfallDeficitEnvironmentalEvent>
{
  readonly eventType = 'rainfall_deficit' as const
  readonly supportedGeometryKinds: EnvironmentalGeometryKind[] = [
    'polygon',
    'multipolygon',
    'administrative_area',
  ]

  supportsGeometry(geometry: GeoJSON.Geometry): boolean {
    return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
  }

  toMapFeature(event: RainfallDeficitEnvironmentalEvent): GeoJSON.Feature {
    const w = event.attributes.windows.days30
    return {
      type: 'Feature',
      id: event.id,
      geometry: event.geometry,
      properties: {
        event_id: event.id,
        event_type: event.eventType,
        title: event.title,
        intensity: event.attributes.intensityClass,
        fill_color: INTENSITY_COLORS[event.attributes.intensityClass],
        observed_mm: w.observedRainfallMm,
        expected_mm: w.expectedRainfallMm,
        deficit_pct: w.relativeDeficitPercent,
        percentile: w.historicalPercentile,
        persistence_pentads: event.attributes.consecutiveDeficitPentads,
        product_status: event.attributes.currentProductStatus,
        last_observed_at: event.lastObservedAt,
      },
    }
  }

  getLayerDefinition(): EventMapLayerDefinition {
    return {
      id: 'rainfall-deficit-polygons',
      kind: 'polygon',
      clustered: false,
      colorField: 'intensity',
    }
  }

  getLegendDefinition(): EventLegendDefinition {
    return {
      title: 'Déficit de precipitación',
      groups: [
        {
          title: 'Intensidad',
          items: [
            { label: 'Déficit moderado', color: INTENSITY_COLORS.moderate, shape: 'disc' },
            { label: 'Déficit elevado', color: INTENSITY_COLORS.elevated, shape: 'disc' },
            { label: 'Déficit severo', color: INTENSITY_COLORS.severe, shape: 'disc' },
            { label: 'En recuperación', color: INTENSITY_COLORS.recovering, shape: 'disc' },
          ],
        },
      ],
    }
  }

  getPopupModel(event: RainfallDeficitEnvironmentalEvent): EventMapPopupModel {
    const w = event.attributes.windows.days30
    return {
      title: event.title,
      rows: [
        { label: 'Ventana', value: `${w.analysisWindowDays} días` },
        { label: 'Lluvia observada', value: `${w.observedRainfallMm.toFixed(1)} mm` },
        {
          label: 'Lluvia histórica',
          value: w.expectedRainfallMm !== undefined ? `${w.expectedRainfallMm.toFixed(1)} mm` : 'No disponible',
        },
        {
          label: 'Déficit',
          value:
            w.relativeDeficitPercent !== undefined ? `${w.relativeDeficitPercent} %` : 'No disponible',
        },
        {
          label: 'Percentil',
          value: w.historicalPercentile !== undefined ? `P${w.historicalPercentile}` : 'No disponible',
        },
        {
          label: 'Persistencia',
          value: `${event.attributes.consecutiveDeficitPentads} pentadas`,
        },
        {
          label: 'Actualización',
          value: new Date(event.lastObservedAt).toLocaleDateString('es-GT'),
        },
      ],
      disclaimer:
        'CHIRPS representa precipitación estimada como promedio de área. No describe condiciones exactas de una parcela.',
    }
  }
}

export const rainfallDeficitMapRenderer = new RainfallDeficitMapRenderer()
