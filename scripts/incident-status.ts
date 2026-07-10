#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { countIncidentsByStatus } from '@/pipeline/stores/incidents.store'
import { countIncidentCorrelationJobs } from '@/pipeline/stores/incident-correlation-jobs.store'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const [incidents, jobs] = await Promise.all([
    countIncidentsByStatus(),
    countIncidentCorrelationJobs(),
  ])
  console.log(JSON.stringify({ incidents_by_status: incidents, jobs }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
