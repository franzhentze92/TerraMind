/**
 * Adaptador de contexto climático para eventos térmicos (7B.2).
 * Delega en climate.engine; no ejecutar desde HTTP.
 */
export {
  enrichClimateForEvent,
  eventNeedsClimateEnrichment,
  resolveClimateRuntime,
  runClimateEnrichment,
  ClimateSourceUnavailableError,
} from '@/pipeline/engines/fire/context/climate.engine'

export { enqueueClimateJobs, eventQualifiesForClimateJob } from '@/pipeline/engines/fire/context/climate-jobs.engine'
