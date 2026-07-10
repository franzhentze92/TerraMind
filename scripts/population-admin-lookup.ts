#!/usr/bin/env tsx
import { parseCliArgs, sanitizeJsonForCli } from '@/modules/territory/population/cli/population-cli-utils'
import { createPopulationAdminService } from '@/modules/territory/population/admin/population-admin.service'

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const service = createPopulationAdminService()
  const referenceYear = Number(args.year ?? 2020)

  if (args.department) {
    const record = await service.getDepartmentPopulation({
      departmentCode: args.department,
      referenceYear,
      statisticType: args.statistic === 'census' ? 'census' : 'projection',
    })
    console.log(JSON.stringify(sanitizeJsonForCli({ department: record }), null, 2))
    return
  }

  if (args.municipality) {
    const record = await service.getMunicipalityPopulation({
      municipalityCode: args.municipality,
      referenceYear,
      statisticType: 'census',
    })
    console.log(JSON.stringify(sanitizeJsonForCli({ municipality: record }), null, 2))
    return
  }

  throw new Error('Especificar --department=<code> o --municipality=<code>')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
