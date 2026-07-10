#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { countActivePriorityAssessments } from '@/pipeline/stores/priority-assessments.store'
import { countPriorityJobs } from '@/pipeline/stores/priority-jobs.store'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const [activeAssessments, jobs] = await Promise.all([
    countActivePriorityAssessments(),
    countPriorityJobs(),
  ])
  console.log(
    JSON.stringify(
      {
        active_assessments: activeAssessments,
        jobs,
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
