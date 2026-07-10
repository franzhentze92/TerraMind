#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { parseCliArgs } from '@/modules/territory/population/cli/population-cli-utils'
import { FindingPriorityWorker } from '@/pipeline/workers/priority-evaluation.worker'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const once = args.once === 'true' || process.argv.includes('--once')
  const worker = new FindingPriorityWorker()
  const metrics = once ? await worker.processOnce() : await worker.runUntilEmpty()
  console.log(JSON.stringify(metrics, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
