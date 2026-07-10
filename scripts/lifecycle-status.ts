#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { countLifecycleJobs } from '@/pipeline/stores/lifecycle-jobs.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const supabase = getSupabaseAdmin()
  const [jobs, eventsByState] = await Promise.all([
    countLifecycleJobs().catch(() => null),
    supabase
      .from('fire_events')
      .select('lifecycle_state')
      .then((r) => {
        if (r.error) return null
        const counts: Record<string, number> = {}
        for (const row of r.data ?? []) {
          const state = String(row.lifecycle_state ?? 'unknown')
          counts[state] = (counts[state] ?? 0) + 1
        }
        return counts
      }),
  ])

  const { count: transitionCount } = await supabase
    .from('event_lifecycle_transitions')
    .select('id', { count: 'exact', head: true })

  console.log(
    JSON.stringify(
      {
        events_by_lifecycle_state: eventsByState,
        transition_records: transitionCount ?? 0,
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
