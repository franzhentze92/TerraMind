/**
 * Environmental Event Framework — thermal priority factor provider.
 *
 * Surfaces QUALITATIVE priority factors derived from thermal attributes. It does
 * NOT compute or override the canonical priority score, caps, thresholds or
 * explanations — those remain in the Finding Priority Engine and are served
 * unchanged through the priority API.
 */
import type {
  EventPriorityFactorProvider,
  PriorityContext,
  PriorityFactorContribution,
} from '@/modules/environmental-events/contracts/priority-provider'
import type { ThermalEnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

export const THERMAL_PRIORITY_PROVIDER_ID = 'thermal_priority_factors'

export class ThermalPriorityFactorProvider
  implements EventPriorityFactorProvider<ThermalEnvironmentalEvent>
{
  readonly eventType = 'thermal_activity' as const

  getSeverityFactors(
    event: ThermalEnvironmentalEvent,
    _context: PriorityContext = {},
  ): PriorityFactorContribution[] {
    const factors: PriorityFactorContribution[] = []
    if (event.attributes.maxFrp != null && event.attributes.maxFrp > 0) {
      factors.push({
        domain: 'severity',
        label: 'Energía radiativa observada',
        direction: 'increases',
        rationale: `Energía radiativa máxima de ${event.attributes.maxFrp.toFixed(2)} MW.`,
      })
    }
    return factors
  }

  getExposureFactors(
    _event: ThermalEnvironmentalEvent,
    _context: PriorityContext = {},
  ): PriorityFactorContribution[] {
    // Exposure is resolved by enrichment/finding rules, not by this provider.
    return []
  }

  getPersistenceFactors(
    event: ThermalEnvironmentalEvent,
    _context: PriorityContext = {},
  ): PriorityFactorContribution[] {
    if (event.persistence != null && event.persistence > 0) {
      return [
        {
          domain: 'persistence',
          label: 'Persistencia térmica',
          direction: 'increases',
          rationale: `Actividad térmica sostenida durante ${event.persistence.toFixed(1)} h.`,
        },
      ]
    }
    return []
  }

  getSensitivityFactors(
    _event: ThermalEnvironmentalEvent,
    _context: PriorityContext = {},
  ): PriorityFactorContribution[] {
    return []
  }

  getUncertaintyFactors(
    event: ThermalEnvironmentalEvent,
    _context: PriorityContext = {},
  ): PriorityFactorContribution[] {
    if (event.attributes.detectionCount <= 1) {
      return [
        {
          domain: 'uncertainty',
          label: 'Evidencia limitada',
          direction: 'increases',
          rationale: 'Basado en una sola detección satelital; requiere corroboración.',
        },
      ]
    }
    if (event.attributes.satelliteCount > 1) {
      return [
        {
          domain: 'uncertainty',
          label: 'Evidencia multi-satélite',
          direction: 'decreases',
          rationale: 'Confirmado por múltiples fuentes satelitales.',
        },
      ]
    }
    return []
  }

  getUrgencyFactors(event: ThermalEnvironmentalEvent, context: PriorityContext): PriorityFactorContribution[] {
    const now = context.now ?? new Date()
    const last = new Date(event.lastObservedAt).getTime()
    const hoursSince = (now.getTime() - last) / 3_600_000
    if (Number.isFinite(hoursSince) && hoursSince <= 6) {
      return [
        {
          domain: 'urgency',
          label: 'Actividad reciente',
          direction: 'increases',
          rationale: 'Última detección dentro de las 6 horas previas.',
        },
      ]
    }
    return []
  }
}

export const thermalPriorityFactorProvider = new ThermalPriorityFactorProvider()
