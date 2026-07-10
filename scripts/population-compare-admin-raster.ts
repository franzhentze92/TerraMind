#!/usr/bin/env tsx
import { parseCliArgs, sanitizeJsonForCli } from '@/modules/territory/population/cli/population-cli-utils'
import {
  compareAdministrativeUnitToRaster,
  compareAllDepartmentsToRaster,
  compareNationalToRaster,
} from '@/modules/territory/population/admin/population-admin-raster-report'

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const level = (args.level ?? 'department') as 'national' | 'department' | 'municipality'
  const referenceYear = Number(args.year ?? 2020)

  if (level === 'national') {
    const comparison = await compareNationalToRaster(referenceYear)
    console.log(JSON.stringify(sanitizeJsonForCli({ comparison }), null, 2))
    return
  }

  if (args.all === 'true' || process.argv.includes('--all')) {
    const comparisons = await compareAllDepartmentsToRaster(referenceYear)
    console.log(JSON.stringify(sanitizeJsonForCli({ count: comparisons.length, comparisons }), null, 2))
    return
  }

  const code = args.code
  if (!code) {
    throw new Error('Especificar --code=<adminCode> o --all para departamentos')
  }

  const comparison = await compareAdministrativeUnitToRaster({
    adminLevel: level,
    adminCode: code,
    referenceYear,
  })
  console.log(JSON.stringify(sanitizeJsonForCli({ comparison }), null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
