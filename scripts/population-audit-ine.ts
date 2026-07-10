#!/usr/bin/env tsx
import { sanitizeJsonForCli } from '@/modules/territory/population/cli/population-cli-utils'
import { getPopulationAdminSourcesStatus } from '@/modules/territory/population/admin/population-admin-source-status'
import { auditRuralHuehuetenango } from '@/modules/territory/population/audit/rural-huehuetenango-audit'
import {
  buildAdminStatisticsRecords,
  runIneImport,
  validateAdminRecords,
} from '@/modules/territory/population/providers/ine/ine-import-builder'

async function main() {
  const admin = buildAdminStatisticsRecords()
  const warnings = validateAdminRecords(admin)
  const status = getPopulationAdminSourcesStatus()
  const ruralAudit = await auditRuralHuehuetenango()

  let idempotent: ReturnType<typeof runIneImport> | undefined
  try {
    idempotent = runIneImport('dry-run')
  } catch {
    /* ignore */
  }

  console.log(
    JSON.stringify(
      sanitizeJsonForCli({
        validation: {
          departmentCount: admin.filter((r) => r.adminLevel === 'department' && r.isCensus).length,
          nationalCensus2018: admin.find(
            (r) => r.adminLevel === 'national' && r.statisticType === 'census',
          )?.populationTotal,
          nationalProjection2020: admin.find(
            (r) => r.adminLevel === 'national' && r.statisticType === 'projection',
          )?.populationTotal,
          warnings,
        },
        sourceStatus: status,
        ruralHuehuetenango: ruralAudit,
        idempotentDryRun: idempotent,
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
