/**
 * Adaptador incendios → población (7D.3).
 * Delega en population.engine; no ejecutar desde HTTP.
 */
export {
  enrichPopulationForEvent,
  runPopulationEnrichment,
  resolvePopulationRuntime,
  eventNeedsPopulationEnrichment,
  PopulationSourceUnavailableError,
  type PopulationEnrichResultRow,
  type PopulationRuntimeContext,
} from '@/pipeline/engines/fire/context/population.engine'
