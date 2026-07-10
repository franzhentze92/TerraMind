#!/usr/bin/env tsx
import { sanitizeJsonForCli } from '@/modules/territory/population/cli/population-cli-utils'
import {
  buildAdminStatisticsRecords,
  buildSettlementRecordsFromHdx,
  validateAdminRecords,
} from '@/modules/territory/population/providers/ine/ine-import-builder'
import { INE_SOURCE_INVENTORY } from '@/modules/territory/population/providers/ine/ine-sources-inventory'

async function main() {
  const admin = buildAdminStatisticsRecords()
  const settlements = buildSettlementRecordsFromHdx()
  const warnings = validateAdminRecords(admin)

  console.log(
    JSON.stringify(
      sanitizeJsonForCli({
        inventory: INE_SOURCE_INVENTORY,
        adminRecords: admin.length,
        departmentsCensus: admin.filter((r) => r.adminLevel === 'department' && r.isCensus).length,
        departmentsProjection: admin.filter((r) => r.adminLevel === 'department' && r.isProjection)
          .length,
        municipalities: admin.filter((r) => r.adminLevel === 'municipality').length,
        settlements: settlements.length,
        warnings,
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
