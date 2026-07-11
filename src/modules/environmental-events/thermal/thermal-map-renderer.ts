/**
 * Environmental Event Framework — thermal point map renderer.
 *
 * Produces map data models (feature/layer/legend/popup) for point-based thermal
 * events. Encapsulates thermal styling: points, clustering, radiative energy,
 * detections, sources, lifecycle and priority. It does NOT replace FireEventsMap;
 * the existing component keeps working while consumers can adopt this layer.
 */
import type { EnvironmentalEventMapRenderer } from '@/modules/environmental-events/contracts/map-renderer'
import type {
  EventLegendDefinition,
  EventMapLayerDefinition,
  EventMapPopupModel,
} from '@/modules/environmental-events/contracts/map-renderer'
import type { EnvironmentalGeometryKind } from '@/modules/environmental-events/types/taxonomy'
import type { ThermalEnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import { pluralizeCount, THERMAL_SCIENTIFIC_DISCLAIMER } from '@/modules/fires/utils/thermal-labels'
import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'

export class ThermalPointEventMapRenderer
  implements EnvironmentalEventMapRenderer<ThermalEnvironmentalEvent>
{
  readonly eventType = 'thermal_activity' as const
  readonly supportedGeometryKinds: EnvironmentalGeometryKind[] = ['point', 'multipoint']

  supportsGeometry(geometry: GeoJSON.Geometry): boolean {
    return geometry.type === 'Point' || geometry.type === 'MultiPoint'
  }

  toMapFeature(event: ThermalEnvironmentalEvent): GeoJSON.Feature {
    return {
      type: 'Feature',
      id: event.id,
      geometry: event.geometry,
      properties: {
        event_id: event.id,
        event_type: event.eventType,
        title: buildThermalEventDisplayName({
          department_name: event.territory?.departmentName ?? null,
          first_detected_at: event.firstObservedAt,
          validation_status: event.attributes.legacy
            .validationStatus as 'no_validado' | 'probable' | 'confirmado',
        }),
        status: event.status,
        risk_level: event.attributes.legacy.riskLevel,
        priority_score: event.attributes.legacy.priorityScore,
        detection_count: event.attributes.detectionCount,
        satellite_count: event.attributes.satelliteCount,
        last_detected_at: event.lastObservedAt,
      },
    }
  }

  getLayerDefinition(): EventMapLayerDefinition {
    return {
      id: 'thermal-activity-points',
      kind: 'cluster',
      clustered: true,
      colorField: 'risk_level',
    }
  }

  getLegendDefinition(): EventLegendDefinition {
    return {
      title: 'Actividad térmica',
      groups: [
        {
          title: 'Nivel de riesgo',
          items: [
            { label: 'Crítico / Alto / Atención', color: '#dc2626', shape: 'disc' },
            { label: 'Observación', color: '#f59e0b', shape: 'disc' },
            { label: 'Informativo', color: '#64748b', shape: 'disc' },
          ],
        },
      ],
    }
  }

  getPopupModel(event: ThermalEnvironmentalEvent): EventMapPopupModel {
    return {
      title: buildThermalEventDisplayName({
        department_name: event.territory?.departmentName ?? null,
        first_detected_at: event.firstObservedAt,
        validation_status: event.attributes.legacy
          .validationStatus as 'no_validado' | 'probable' | 'confirmado',
      }),
      rows: [
        {
          label: 'Detecciones',
          value: pluralizeCount(event.attributes.detectionCount, 'detección', 'detecciones'),
        },
        {
          label: 'Fuentes',
          value: pluralizeCount(event.attributes.satelliteCount, 'fuente', 'fuentes'),
        },
        {
          label: 'Energía radiativa',
          value:
            event.attributes.maxFrp != null
              ? `${event.attributes.maxFrp.toFixed(2)} MW`
              : 'No reportada',
        },
      ],
      disclaimer: THERMAL_SCIENTIFIC_DISCLAIMER,
    }
  }
}

export const thermalMapRenderer = new ThermalPointEventMapRenderer()
