import { config } from 'dotenv'
import { resolve } from 'node:path'
import { createLandCoverService } from '@/modules/territory/land-cover/land-cover.service'
import { buildLandCoverContextVersion } from '@/modules/territory/land-cover/land-cover-context-version'
import {
  LAND_COVER_AREA_STRATEGY,
  LAND_COVER_BUFFER_UNION_METHOD,
  LAND_COVER_NODATA_POLICY,
} from '@/modules/territory/land-cover/land-cover-context-version'
import { getLandCoverEnrichmentHealth } from '@/pipeline/workers/land-cover-enrichment.worker'
import {
  countEventsWithoutLandCoverContext,
  countLandCoverJobsByStatus,
} from '@/pipeline/stores/land-cover-jobs.store'
import { countLandCoverContexts } from '@/pipeline/stores/land-cover.store'
import { loadLandCoverWorkerConfig } from '@/pipeline/config/land-cover-worker.config'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const service = createLandCoverService()
  const status = await service.getSourceStatus()
  const persisted = await countLandCoverContexts()
  const workerConfig = loadLandCoverWorkerConfig()
  const jobCounts = await countLandCoverJobsByStatus()
  const eventsWithoutContext = await countEventsWithoutLandCoverContext().catch(() => null)
  const health = await getLandCoverEnrichmentHealth().catch(() => null)

  const radii = [500, 1000]
  if (process.env.LAND_COVER_RADIUS_3KM_ENABLED === 'true') radii.push(3000)

  const contextVersion =
    status.available && status.analyticCogSha256
      ? buildLandCoverContextVersion({
          sourceVersion: status.sourceVersion!,
          rasterHash: status.analyticCogSha256!,
          mapperVersion: status.mapperVersion!,
          analysisMethodVersion: status.analysisMethodVersion!,
          zoneRadiiM: radii,
          nodataPolicy: LAND_COVER_NODATA_POLICY,
          areaStrategy: LAND_COVER_AREA_STRATEGY,
          bufferUnionMethod: LAND_COVER_BUFFER_UNION_METHOD,
        })
      : null

  console.log(
    JSON.stringify(
      {
        event: 'land_cover_context_status',
        raster_available: status.available,
        source_version: status.sourceVersion,
        source_year: status.sourceYear,
        mapper_version: status.mapperVersion,
        analysis_method_version: status.analysisMethodVersion,
        area_strategy: status.areaStrategy,
        source_cog_sha256: status.sourceCogSha256,
        analytic_cog_sha256: status.analyticCogSha256,
        persisted_context_count: persisted,
        context_version_current: contextVersion,
        radii_default_m: [500, 1000],
        radius_3km_enabled: process.env.LAND_COVER_RADIUS_3KM_ENABLED === 'true',
        enrichment_enabled: workerConfig.enrichmentEnabled,
        worker_concurrency: workerConfig.workerConcurrency,
        jobs: jobCounts,
        events_without_context: eventsWithoutContext,
        land_cover_enrichment: health,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
