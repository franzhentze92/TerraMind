#!/usr/bin/env tsx
import { sanitizeJsonForCli } from '@/modules/territory/population/cli/population-cli-utils'
import { createPopulationService } from '@/modules/territory/population/population.service'

async function main() {
  const service = createPopulationService()
  const status = await service.getSourceStatus()
  console.log(JSON.stringify(sanitizeJsonForCli(status), null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
