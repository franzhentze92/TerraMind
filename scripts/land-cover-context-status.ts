import { config } from 'dotenv'
import { resolve } from 'node:path'
import { createLandCoverService } from '@/modules/territory/land-cover/land-cover.service'
import { countLandCoverContexts } from '@/pipeline/stores/land-cover.store'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const service = createLandCoverService()
  const status = await service.getSourceStatus()
  const persisted = await countLandCoverContexts()

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
        radii_default_m: [500, 1000],
        radius_3km_enabled: process.env.LAND_COVER_RADIUS_3KM_ENABLED === 'true',
        enrichment_concurrency: Number(process.env.LAND_COVER_ENRICHMENT_CONCURRENCY ?? 1),
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
