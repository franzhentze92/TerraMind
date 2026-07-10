#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { parseCliArgs } from '@/modules/territory/population/cli/population-cli-utils'
import { enqueuePriorityJobs } from '@/pipeline/engines/priorities/priority-jobs.engine'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const force = args.force === 'true' || process.argv.includes('--force')
  const metrics = await enqueuePriorityJobs({
    force,
    eventId: args.event,
    limit: args.limit ? Number(args.limit) : undefined,
  })
  console.log(JSON.stringify(metrics, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
