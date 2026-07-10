#!/usr/bin/env tsx
import {
  parseCliArgs,
  parseRadiiArg,
  requireNumberArg,
  sanitizeJsonForCli,
} from '@/modules/territory/population/cli/population-cli-utils'
import { createPopulationService } from '@/modules/territory/population/population.service'

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const lat = requireNumberArg(args, 'lat', ['latitude'])
  const lon = requireNumberArg(args, 'lon', ['longitude'])
  const radii = parseRadiiArg(args.radii)
  const includeValidation = args.validation === 'true' || args.includeValidation === 'true'

  const service = createPopulationService()
  const result = await service.analyzeBuffers({
    points: [{ lat, lon }],
    radiiMeters: radii,
    includeValidation,
  })
  console.log(JSON.stringify(sanitizeJsonForCli(result), null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
