/**
 * Environmental Event Framework — thermal presentation adapter.
 *
 * Reuses the existing thermal copy utilities. No translations are duplicated;
 * all output is Spanish.
 */
import type { EnvironmentalEventPresentationAdapter } from '@/modules/environmental-events/contracts/presentation'
import type {
  EventKeyMetric,
  ThermalEnvironmentalEvent,
} from '@/modules/environmental-events/types/environmental-event.types'
import { buildThermalEventDisplayName } from '@/modules/fires/utils/thermal-event-display'
import {
  pluralizeCount,
  thermalLifecycleLabel,
  THERMAL_SCIENTIFIC_DISCLAIMER,
} from '@/modules/fires/utils/thermal-labels'
import {
  eventStatusLabel,
  validationStatusLabel,
  buildEventInterpretation,
} from '@/modules/fires/utils/fire-interpretation'

const SEVERITY_LABELS: Record<number, string> = {
  1: 'Informativo',
  2: 'Observación',
  3: 'Atención',
  4: 'Alto',
  5: 'Crítico',
}

export class ThermalEventPresentationAdapter
  implements EnvironmentalEventPresentationAdapter<ThermalEnvironmentalEvent>
{
  readonly eventType = 'thermal_activity' as const

  getDisplayName(event: ThermalEnvironmentalEvent): string {
    return buildThermalEventDisplayName({
      department_name: event.territory?.departmentName ?? null,
      first_detected_at: event.firstObservedAt,
      validation_status:
        event.attributes.legacy.validationStatus as 'no_validado' | 'probable' | 'confirmado',
    })
  }

  getSummary(event: ThermalEnvironmentalEvent): string {
    if (event.summary) return event.summary
    return buildEventInterpretation({
      detection_count: event.attributes.detectionCount,
      satellite_count: event.attributes.satelliteCount,
      validation_status: event.attributes.legacy.validationStatus,
      risk_level: event.attributes.legacy.riskLevel,
      persistence_hours: event.attributes.persistenceHours ?? null,
      multisatellite: event.attributes.satelliteCount > 1,
    })
  }

  getStatusLabel(event: ThermalEnvironmentalEvent): string {
    return eventStatusLabel(event.attributes.legacy.status)
  }

  getLifecycleLabel(event: ThermalEnvironmentalEvent): string {
    return thermalLifecycleLabel(event.lifecycleState ?? event.attributes.legacy.status)
  }

  getSeverityLabel(event: ThermalEnvironmentalEvent): string {
    return SEVERITY_LABELS[event.severity ?? 0] ?? 'Sin clasificar'
  }

  getConfidenceLabel(event: ThermalEnvironmentalEvent): string {
    return validationStatusLabel(event.attributes.legacy.validationStatus)
  }

  getLimitations(event: ThermalEnvironmentalEvent): string[] {
    return event.limitations && event.limitations.length > 0
      ? event.limitations
      : [THERMAL_SCIENTIFIC_DISCLAIMER]
  }

  getKeyMetrics(event: ThermalEnvironmentalEvent): EventKeyMetric[] {
    const metrics: EventKeyMetric[] = [
      {
        key: 'detections',
        label: 'Detecciones contribuyentes',
        value: pluralizeCount(event.attributes.detectionCount, 'detección', 'detecciones'),
      },
      {
        key: 'satellites',
        label: 'Fuentes satelitales',
        value: pluralizeCount(event.attributes.satelliteCount, 'fuente', 'fuentes'),
      },
    ]
    if (event.attributes.maxFrp != null) {
      metrics.push({
        key: 'max_frp',
        label: 'Energía radiativa máxima',
        value: `${event.attributes.maxFrp.toFixed(2)} MW`,
      })
    }
    if (event.persistence != null) {
      metrics.push({
        key: 'persistence',
        label: 'Persistencia',
        value: `${event.persistence.toFixed(1)} h`,
      })
    }
    return metrics
  }
}

export const thermalPresentationAdapter = new ThermalEventPresentationAdapter()
