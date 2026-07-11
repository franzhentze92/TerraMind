/** Déficit de precipitación plugin — server wiring (SCAFFOLD). */
import { serverEventRegistry } from '@/modules/environmental-events/registry/server-event-registry'
import { rainfallDeficitRepository } from '@/events/rainfall-deficit/event.repository'
import { rainfallDeficitDetector } from '@/events/rainfall-deficit/event.detector'
import {
  chirpsV3FinalAdapter,
  chirpsV3PreliminaryAdapter,
} from '../services/environmental-events/chirps-v3-source.adapter.js'

serverEventRegistry.register({
  type: 'rainfall_deficit',
  repository: rainfallDeficitRepository,
  detector: rainfallDeficitDetector,
  sourceAdapters: [chirpsV3PreliminaryAdapter, chirpsV3FinalAdapter],
})
