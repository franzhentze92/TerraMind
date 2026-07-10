/**
 * Adaptador incendios → LandCoverService genérico.
 * Commit 7A.2-D: delega al motor de enriquecimiento incremental.
 */

export {
  runLandCoverEnrichment,
  enrichLandCoverForEvent,
  resolveLandCoverRuntime,
  eventNeedsLandCoverEnrichment,
  type LandCoverEnrichMetrics,
  type LandCoverEnrichOptions,
  type LandCoverEnrichResultRow,
  type LandCoverRuntimeContext,
  LandCoverSourceUnavailableError,
} from '@/pipeline/engines/fire/context/land-cover.engine'

export { enqueueLandCoverJobs } from '@/pipeline/engines/fire/context/land-cover-jobs.engine'
