/**
 * Adaptador futuro incendios → población (7D.3).
 * NO IMPLEMENTAR en 7D.1.
 *
 * Flujo:
 *   fire detections / event geometry
 *     → unified buffer union (500m–5km)
 *     → PopulationService.analyzeBuffers()
 *     → persist entity_population_context + entity_population_zones
 *     → API (futuro)
 *     → UI tab "Territorio → Población y asentamientos"
 */

import type { PopulationAnalysis } from '../population.types'

export interface FirePopulationAdapterInput {
  fireEventId: string
  detectionPoints: Array<{ lon: number; lat: number; id?: string }>
  radiiMeters?: number[]
}

export interface FirePopulationAdapterResult {
  fireEventId: string
  populationContext: PopulationAnalysis
  persisted: false
}

export interface FirePopulationAdapter {
  enrichFireEvent(input: FirePopulationAdapterInput): Promise<FirePopulationAdapterResult>
}

/** Placeholder — lanza hasta que PopulationService esté operativo. */
export function createFirePopulationAdapter(): FirePopulationAdapter {
  return {
    async enrichFireEvent() {
      throw new Error('fire-population.adapter: pendiente 7D.3')
    },
  }
}
