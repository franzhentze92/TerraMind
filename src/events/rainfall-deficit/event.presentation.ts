/** Déficit de precipitación — presentation adapter (Spanish). */
import type { EnvironmentalEventPresentationAdapter } from '@/modules/environmental-events/contracts/presentation'
import type { EventKeyMetric } from '@/modules/environmental-events/types/environmental-event.types'
import { LIFECYCLE_LABELS } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.lifecycle'
import type { RainfallDeficitEnvironmentalEvent } from './event.types'
import { rainfallDeficitLimitations } from './event.limitations'

const INTENSITY_LABELS = {
  moderate: 'Déficit moderado',
  elevated: 'Déficit elevado',
  severe: 'Déficit severo',
  recovering: 'En recuperación',
} as const

const PRODUCT_LABELS = {
  preliminary: 'Preliminar',
  final: 'Final',
} as const

function fmtMm(v?: number): string {
  if (v === undefined || !Number.isFinite(v)) return 'No disponible'
  return `${v.toFixed(1)} mm`
}

function fmtPct(v?: number): string {
  if (v === undefined || !Number.isFinite(v)) return 'No disponible'
  return `${v} %`
}

export class RainfallDeficitPresentationAdapter
  implements EnvironmentalEventPresentationAdapter<RainfallDeficitEnvironmentalEvent>
{
  readonly eventType = 'rainfall_deficit' as const

  getDisplayName(event: RainfallDeficitEnvironmentalEvent): string {
    return event.title
  }
  getSummary(event: RainfallDeficitEnvironmentalEvent): string {
    return (
      event.summary ??
      'La precipitación acumulada reciente está por debajo de la distribución histórica esperada para esta zona y época del año.'
    )
  }
  getStatusLabel(event: RainfallDeficitEnvironmentalEvent): string {
    return event.status === 'active' ? 'Activo' : 'Finalizado'
  }
  getLifecycleLabel(event: RainfallDeficitEnvironmentalEvent): string {
    return event.lifecycleState ? LIFECYCLE_LABELS[event.lifecycleState] : 'Sin clasificar'
  }
  getSeverityLabel(event: RainfallDeficitEnvironmentalEvent): string {
    return INTENSITY_LABELS[event.attributes.intensityClass]
  }
  getConfidenceLabel(event: RainfallDeficitEnvironmentalEvent): string {
    return PRODUCT_LABELS[event.attributes.currentProductStatus]
  }
  getLimitations(): string[] {
    return rainfallDeficitLimitations
  }
  getKeyMetrics(event: RainfallDeficitEnvironmentalEvent): EventKeyMetric[] {
    const w = event.attributes.windows.days30
    return [
      { key: 'period', label: 'Periodo evaluado', value: `${w.analysisWindowDays} días` },
      { key: 'observed', label: 'Precipitación observada', value: fmtMm(w.observedRainfallMm) },
      { key: 'expected', label: 'Precipitación histórica esperada', value: fmtMm(w.expectedRainfallMm) },
      { key: 'deficit_abs', label: 'Déficit absoluto', value: fmtMm(w.absoluteDeficitMm) },
      { key: 'deficit_rel', label: 'Déficit relativo', value: fmtPct(w.relativeDeficitPercent) },
      {
        key: 'percentile',
        label: 'Percentil histórico',
        value: w.historicalPercentile !== undefined ? `P${w.historicalPercentile}` : 'No disponible',
      },
      {
        key: 'persistence',
        label: 'Persistencia',
        value: `${event.attributes.consecutiveDeficitPentads} pentadas (${event.attributes.persistenceDays} días)`,
      },
      {
        key: 'area',
        label: 'Área bajo señal',
        value: `${event.attributes.affectedAreaKm2.toFixed(0)} km²`,
      },
      {
        key: 'product',
        label: 'Estado del producto',
        value: PRODUCT_LABELS[event.attributes.currentProductStatus],
      },
      {
        key: 'updated',
        label: 'Última actualización',
        value: new Date(event.lastObservedAt).toLocaleDateString('es-GT'),
      },
    ]
  }
}

export const rainfallDeficitPresentationAdapter = new RainfallDeficitPresentationAdapter()
