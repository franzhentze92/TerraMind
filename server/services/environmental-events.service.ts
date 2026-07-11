/**
 * Environmental Event Framework — generic read service (server).
 *
 * Resolves canonical events by delegating to per-type repository adapters that
 * plugins register in the shared server registry. Adding an event type never
 * edits this service: manifests come from the generated manifest index and
 * repositories from the generated server index.
 *
 *   generic service → server registry → repository adapter → existing stores
 */
import '@/modules/environmental-events'
import '../events/server.generated.js'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { serverEventRegistry } from '@/modules/environmental-events/registry/server-event-registry'
import type {
  EnvironmentalEvent,
  EnvironmentalEventPage,
  EnvironmentalEventQuery,
  EnvironmentalEventTypeSummary,
} from '@/modules/environmental-events/types/environmental-event.types'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalEventRepository } from '@/modules/environmental-events/contracts/repository'

function resolveRepository(type: EnvironmentalEventType): EnvironmentalEventRepository {
  if (!environmentalEventRegistry.isEnabled(type)) {
    throw new Error(`Tipo de evento no disponible en runtime: "${type}"`)
  }
  const repo = serverEventRegistry.getRepository(type)
  if (!repo) {
    throw new Error(`Tipo de evento sin repositorio: "${type}"`)
  }
  return repo
}

/** Types that have a working repository (used by audits). */
export function repositoryBackedTypes(): EnvironmentalEventType[] {
  return serverEventRegistry.backedTypes()
}

export async function listEnvironmentalEvents(
  query: EnvironmentalEventQuery,
): Promise<EnvironmentalEventPage> {
  const type = query.type ?? 'thermal_activity'
  const repo = resolveRepository(type)
  return repo.list({ ...query, type })
}

export async function getEnvironmentalEventById(
  id: string,
  type: EnvironmentalEventType = 'thermal_activity',
): Promise<EnvironmentalEvent | null> {
  const repo = resolveRepository(type)
  return repo.getById(id)
}

/**
 * Per-type summaries for Situación Nacional. Built entirely from the manifest
 * registry + each plugin's optional `summarize()`. New event types appear here
 * automatically with zero edits to this function.
 */
export async function getEnvironmentalEventTypeSummaries(
  windowHours = 48,
): Promise<EnvironmentalEventTypeSummary[]> {
  const summaries: EnvironmentalEventTypeSummary[] = []
  for (const manifest of environmentalEventRegistry.listEnabled()) {
    const repo = serverEventRegistry.getRepository(manifest.type)
    if (!repo?.summarize) continue
    const snapshot = await repo.summarize(windowHours)
    summaries.push({
      type: manifest.type,
      label: manifest.label,
      activeCount: snapshot.activeCount,
      newCount: snapshot.newCount,
      status: snapshot.status,
    })
  }
  return summaries
}
