import type { Observacion } from '@/ontology/entities/observacion'

export interface ObservationEngineResult {
  newObservations: Observacion[]
  totalCount: number
}

/**
 * Observation Engine — normaliza y deduplica observaciones entrantes.
 */
export function processObservations(
  incoming: Observacion[],
  existing: Observacion[],
): ObservationEngineResult {
  const existingIds = new Set(existing.map((o) => o.id))
  const newObservations = incoming.filter((o) => !existingIds.has(o.id))

  return {
    newObservations,
    totalCount: existing.length + newObservations.length,
  }
}
