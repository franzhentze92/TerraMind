/**
 * Environmental Event Framework — server-side runtime registry.
 *
 * Server-only pieces (repository, detector, source runtime adapters) are wired
 * here by each plugin's `event.server.ts`. The generic service resolves them by
 * type, so adding an event never edits the service. Kept separate from the
 * shared manifest so server code (supabase, ingest) never reaches the client
 * bundle.
 */
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalEventRepository } from '@/modules/environmental-events/contracts/repository'
import type { EnvironmentalEventDetector } from '@/modules/environmental-events/contracts/detector'
import type { ObservationSourceAdapter } from '@/modules/environmental-events/types/observation.types'

export interface ServerEventRegistration {
  type: EnvironmentalEventType
  repository: EnvironmentalEventRepository
  detector?: EnvironmentalEventDetector<any, any>
  sourceAdapters?: ObservationSourceAdapter<any, any>[]
}

export class ServerEventRegistry {
  private readonly entries = new Map<EnvironmentalEventType, ServerEventRegistration>()

  register(entry: ServerEventRegistration): void {
    // Idempotent: last registration wins to keep loaders safe to re-run.
    this.entries.set(entry.type, entry)
  }

  getRepository(type: EnvironmentalEventType): EnvironmentalEventRepository | undefined {
    return this.entries.get(type)?.repository
  }

  getDetector(type: EnvironmentalEventType): EnvironmentalEventDetector<any, any> | undefined {
    return this.entries.get(type)?.detector
  }

  backedTypes(): EnvironmentalEventType[] {
    return [...this.entries.keys()]
  }

  has(type: EnvironmentalEventType): boolean {
    return this.entries.has(type)
  }

  clear(): void {
    this.entries.clear()
  }
}

export const serverEventRegistry = new ServerEventRegistry()
