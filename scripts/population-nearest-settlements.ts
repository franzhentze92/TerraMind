#!/usr/bin/env tsx
import { parseCliArgs, requireNumberArg, sanitizeJsonForCli } from '@/modules/territory/population/cli/population-cli-utils'
import { findNearestSettlementsAtPoint } from '@/modules/territory/population/admin/settlement-index'

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const lat = requireNumberArg(args, 'lat')
  const lon = requireNumberArg(args, 'lon')
  const limit = args.limit ? Number(args.limit) : 5

  const settlements = findNearestSettlementsAtPoint(lat, lon, limit)
  console.log(JSON.stringify(sanitizeJsonForCli({ lat, lon, settlements }), null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
