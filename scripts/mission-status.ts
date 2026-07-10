#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { countMissionCreationJobs } from '@/pipeline/stores/mission-creation-jobs.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const jobs = await countMissionCreationJobs()
  const supabase = getSupabaseAdmin()
  const { count: missionCount } = await supabase
    .from('missions')
    .select('*', { count: 'exact', head: true })
  console.log(
    JSON.stringify(
      { jobs, missions: missionCount ?? 0, generated_at: new Date().toISOString() },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
