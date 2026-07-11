/**
 * Thermal activity plugin — server wiring.
 *
 * Registers the server-only runtime (repository/detector/source) for
 * thermal_activity into the shared server registry, keyed by type. Physically
 * separated from the client-safe plugin (src/events/thermal-activity/) because
 * this graph reaches supabase/fire services and must never enter the client
 * bundle. Same logical plugin, split by the repo's client/server boundary.
 */
import { serverEventRegistry } from '@/modules/environmental-events/registry/server-event-registry'
import { thermalEventRepository } from '../services/environmental-events/thermal-event-repository.adapter.js'
import { thermalEventDetector } from '../services/environmental-events/thermal-detector.adapter.js'
import { firmsObservationSourceAdapter } from '../services/environmental-events/firms-source.adapter.js'

serverEventRegistry.register({
  type: 'thermal_activity',
  repository: thermalEventRepository,
  detector: thermalEventDetector,
  sourceAdapters: [firmsObservationSourceAdapter],
})
