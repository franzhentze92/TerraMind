#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { countVerificationPlanJobs } from '@/pipeline/stores/verification-plan-jobs.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const jobs = await countVerificationPlanJobs()
  const supabase = getSupabaseAdmin()
  const { count: planCount } = await supabase
    .from('verification_plans')
    .select('*', { count: 'exact', head: true })
    .in('status', ['draft', 'ready', 'not_required', 'blocked'])
  console.log(
    JSON.stringify(
      {
        jobs,
        active_plans: planCount ?? 0,
        generated_at: new Date().toISOString(),
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
