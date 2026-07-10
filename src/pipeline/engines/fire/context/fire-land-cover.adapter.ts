/**
 * Adaptador incendios → LandCoverService genérico.
 * Commit 7A.2-D: delega al motor de enriquecimiento incremental.
 */

export {
  runLandCoverEnrichment,
  type LandCoverEnrichMetrics,
  type LandCoverEnrichOptions,
  type LandCoverEnrichResultRow,
  LandCoverSourceUnavailableError,
} from '@/pipeline/engines/fire/context/land-cover.engine'
