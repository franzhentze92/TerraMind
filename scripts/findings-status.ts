#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { countFindingJobs } from '@/pipeline/stores/finding-jobs.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const supabase = getSupabaseAdmin()
  const [jobs, findingCount] = await Promise.all([
    countFindingJobs().catch(() => null),
    supabase
      .from('composite_findings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then((r) => (r.error ? -1 : (r.count ?? 0))),
  ])

  console.log(
    JSON.stringify(
      {
        active_findings: findingCount,
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
