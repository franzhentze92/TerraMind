#!/usr/bin/env tsx
import { sanitizeJsonForCli } from '@/modules/territory/population/cli/population-cli-utils'
import { getPopulationAdminSourcesStatus } from '@/modules/territory/population/admin/population-admin-source-status'
import { createPopulationAdminService } from '@/modules/territory/population/admin/population-admin.service'
import { getLocalPopulationSourceStatus } from '@/modules/territory/population/processing/source-status'

async function main() {
  const worldpop = await getLocalPopulationSourceStatus()
  const admin = getPopulationAdminSourcesStatus()
  const adminService = createPopulationAdminService()

  console.log(
    JSON.stringify(
      sanitizeJsonForCli({
        worldpop: {
          operationalHealth: worldpop.isReady ? 'healthy' : 'unavailable',
          referenceYear: worldpop.referenceYear,
        },
        ine: admin.ine,
        settlements: admin.settlements,
        store: adminService.getStoreStatus(),
        availableYears: await adminService.listAvailableReferenceYears(),
      }),
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
