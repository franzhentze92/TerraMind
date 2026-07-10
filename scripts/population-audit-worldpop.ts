#!/usr/bin/env tsx
import { auditWorldPop2020 } from '@/modules/territory/population/processing/audit'

async function main() {
  const report = await auditWorldPop2020()
  console.log(
    JSON.stringify(
      {
        national: report.national,
        recommended: report.recommendedPrimaryVariant,
        departments: report.departments.length,
        zones: report.territorialZones.length,
        reportPath: 'docs/reports/population-worldpop-2020-audit.md',
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
