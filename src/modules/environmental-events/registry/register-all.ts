/**
 * Environmental Event Framework — single registration entrypoint.
 *
 * Registers reusable finding rules + every plugin manifest from the generated
 * index. Idempotent, so it is safe to call from the barrel, the server service,
 * scripts and tests. This is the ONLY place that turns manifests into registry
 * entries; plugins never touch the registry directly.
 */
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import { registerReusableFindingRules } from '@/modules/environmental-events/finding-rules/reusable-rules'
import { ALL_EVENT_MANIFESTS } from '@/events/manifests.generated'

let done = false

export function ensureEventsRegistered(): void {
  if (done) return
  registerReusableFindingRules()
  for (const manifest of ALL_EVENT_MANIFESTS) {
    if (!environmentalEventRegistry.has(manifest.type)) {
      environmentalEventRegistry.registerManifest(manifest)
    }
  }
  done = true
}
