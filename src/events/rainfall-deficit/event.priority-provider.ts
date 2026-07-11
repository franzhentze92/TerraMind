/** Déficit de precipitación — priority factor provider. */
import type {
  EventPriorityFactorProvider,
  PriorityContext,
  PriorityFactorContribution,
} from '@/modules/environmental-events/contracts/priority-provider'
import type { RainfallDeficitEnvironmentalEvent } from './event.types'

export const RAINFALL_DEFICIT_PRIORITY_PROVIDER_ID = 'rainfall_deficit_priority_factors'

export class RainfallDeficitPriorityFactorProvider
  implements EventPriorityFactorProvider<RainfallDeficitEnvironmentalEvent>
{
  readonly eventType = 'rainfall_deficit' as const

  getSeverityFactors(
    event: RainfallDeficitEnvironmentalEvent,
    _context: PriorityContext = {},
  ): PriorityFactorContribution[] {
    const w = event.attributes.windows.days30
    const factors: PriorityFactorContribution[] = []
    if (w.relativeDeficitPercent !== undefined) {
      factors.push({
        domain: 'severity',
        label: 'Déficit relativo',
        direction: 'increases',
        rationale: `Déficit relativo de ${w.relativeDeficitPercent} % en ventana de ${w.analysisWindowDays} días.`,
      })
    }
    if (w.historicalPercentile !== undefined) {
      factors.push({
        domain: 'severity',
        label: 'Percentil histórico',
        direction: 'increases',
        rationale: `Percentil histórico P${w.historicalPercentile}.`,
      })
    }
    if (event.attributes.affectedAreaKm2 > 0) {
      factors.push({
        domain: 'severity',
        label: 'Extensión territorial',
        direction: 'increases',
        rationale: `Área bajo señal de ${event.attributes.affectedAreaKm2.toFixed(0)} km².`,
      })
    }
    return factors
  }

  getExposureFactors(event: RainfallDeficitEnvironmentalEvent): PriorityFactorContribution[] {
    const factors: PriorityFactorContribution[] = []
    if (event.attributes.croplandOverlapKm2 !== undefined && event.attributes.croplandOverlapKm2 > 0) {
      factors.push({
        domain: 'exposure',
        label: 'Área agrícola superpuesta',
        direction: 'increases',
        rationale: `${event.attributes.croplandOverlapKm2.toFixed(0)} km² de área agrícola bajo la señal.`,
      })
    }
    if (event.attributes.municipalityCount !== undefined && event.attributes.municipalityCount > 0) {
      factors.push({
        domain: 'exposure',
        label: 'Municipios comprendidos',
        direction: 'increases',
        rationale: `${event.attributes.municipalityCount} municipios intersectados.`,
      })
    }
    return factors
  }

  getPersistenceFactors(event: RainfallDeficitEnvironmentalEvent): PriorityFactorContribution[] {
    return [
      {
        domain: 'persistence',
        label: 'Pentadas consecutivas',
        direction: 'increases',
        rationale: `${event.attributes.consecutiveDeficitPentads} pentadas consecutivas con señal de déficit.`,
      },
    ]
  }

  getSensitivityFactors(event: RainfallDeficitEnvironmentalEvent): PriorityFactorContribution[] {
    if (event.attributes.dryCorridorOverlapKm2 !== undefined && event.attributes.dryCorridorOverlapKm2 > 0) {
      return [
        {
          domain: 'sensitivity',
          label: 'Corredor Seco',
          direction: 'increases',
          rationale: 'Superposición con el Corredor Seco (capa no disponible en MVP — pendiente).',
        },
      ]
    }
    return []
  }

  getUncertaintyFactors(event: RainfallDeficitEnvironmentalEvent): PriorityFactorContribution[] {
    const factors: PriorityFactorContribution[] = []
    if (event.attributes.currentProductStatus === 'preliminary') {
      factors.push({
        domain: 'uncertainty',
        label: 'Producto preliminar',
        direction: 'increases',
        rationale: 'Basado en producto CHIRPS preliminar; puede revisarse con datos finales.',
      })
    }
    if (event.attributes.terrainComplexityFlag) {
      factors.push({
        domain: 'uncertainty',
        label: 'Terreno complejo',
        direction: 'increases',
        rationale: 'Mayor incertidumbre posible en zonas montañosas.',
      })
    }
    if ((event.attributes.windows.days30.historicalSampleYears ?? 0) < 20) {
      factors.push({
        domain: 'uncertainty',
        label: 'Historia insuficiente',
        direction: 'increases',
        rationale: 'Menos de 20 años históricos válidos para percentiles.',
      })
    }
    return factors
  }

  getUrgencyFactors(event: RainfallDeficitEnvironmentalEvent): PriorityFactorContribution[] {
    const factors: PriorityFactorContribution[] = []
    if (event.lifecycleState === 'expanding') {
      factors.push({
        domain: 'urgency',
        label: 'Expansión',
        direction: 'increases',
        rationale: 'El déficit muestra expansión territorial.',
      })
    }
    if (event.trend?.direction === 'rising') {
      factors.push({
        domain: 'urgency',
        label: 'Intensificación',
        direction: 'increases',
        rationale: 'Tendencia al alza en la señal observada.',
      })
    }
    return factors
  }
}

export const rainfallDeficitPriorityFactorProvider = new RainfallDeficitPriorityFactorProvider()
