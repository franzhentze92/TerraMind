#!/usr/bin/env tsx
import {
  parseCliArgs,
  requireNumberArg,
  sanitizeJsonForCli,
} from '@/modules/territory/population/cli/population-cli-utils'
import { createPopulationService } from '@/modules/territory/population/population.service'

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const lat = requireNumberArg(args, 'lat', ['latitude'])
  const lon = requireNumberArg(args, 'lon', ['longitude'])
  const variant = args.variant === 'unconstrained' ? 'unconstrained' : 'constrained'

  const service = createPopulationService()
  const result = await service.samplePoint({
    latitude: lat,
    longitude: lon,
    variant,
    pointId: args.id,
  })
  console.log(JSON.stringify(sanitizeJsonForCli(result), null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
