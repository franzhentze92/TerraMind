/**
 * Synthetic framework test plugin — server wiring.
 *
 * Registers the pure in-memory repository so the generic service can resolve
 * the type inside tests. Harmless in runtime: the type is disabled and the
 * service rejects disabled types, so it is never queried.
 */
import { serverEventRegistry } from '@/modules/environmental-events/registry/server-event-registry'
import { syntheticRepository } from '@/events/synthetic-framework-test/event.repository'

serverEventRegistry.register({
  type: 'synthetic_framework_test',
  repository: syntheticRepository,
})
