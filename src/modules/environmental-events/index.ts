/**
 * Environmental Event Framework — public barrel.
 *
 * Importing this module guarantees all plugin manifests are registered through
 * the single generated index.
 */
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'

ensureEventsRegistered()

export * from '@/modules/environmental-events/types/taxonomy'
export * from '@/modules/environmental-events/types/environmental-event.types'
export * from '@/modules/environmental-events/types/observation.types'
export * from '@/modules/environmental-events/manifest/event-manifest'
export * from '@/modules/environmental-events/registry/event-type-registry'
export * from '@/modules/environmental-events/registry/finding-rule-registry'
export { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
export { serverEventRegistry } from '@/modules/environmental-events/registry/server-event-registry'
export {
  mapFireEventToEnvironmentalEvent,
  mapFireEventDetailToEnvironmentalEvent,
  mapThermalStatus,
  mapThermalEpistemic,
  FIRMS_SOURCE_ADAPTER_ID,
} from '@/modules/environmental-events/thermal/thermal-event.mapper'
export { registerThermalActivity, thermalActivityDefinition } from '@/modules/environmental-events/thermal/register-thermal'
export { thermalPresentationAdapter } from '@/modules/environmental-events/thermal/thermal-presentation.adapter'
export { thermalMapRenderer } from '@/modules/environmental-events/thermal/thermal-map-renderer'
export { thermalPriorityFactorProvider } from '@/modules/environmental-events/thermal/thermal-priority-provider'
export { thermalFindingRules } from '@/modules/environmental-events/thermal/thermal-finding-rules'
