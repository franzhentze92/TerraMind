#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { countClimateJobsByStatus } from '@/pipeline/stores/climate-jobs.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const supabase = getSupabaseAdmin()
  const [jobs, contextCount] = await Promise.all([
    countClimateJobsByStatus().catch(() => null),
    supabase
      .from('entity_climate_context')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'fire_event')
      .then((r) => (r.error ? -1 : (r.count ?? 0))),
  ])

  console.log(
    JSON.stringify(
      {
        fire_event_contexts: contextCount,
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
