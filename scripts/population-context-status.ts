#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import {
  countPopulationAdminInSupabase,
  countPopulationSettlementsInSupabase,
} from '@/modules/territory/population/providers/ine/population-supabase-seed'
import { countPopulationJobsByStatus } from '@/pipeline/stores/population-jobs.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const supabase = getSupabaseAdmin()
  const [adminCount, settlementCount, jobs, contextCount] = await Promise.all([
    countPopulationAdminInSupabase().catch(() => -1),
    countPopulationSettlementsInSupabase().catch(() => -1),
    countPopulationJobsByStatus().catch(() => null),
    supabase
      .from('entity_population_context')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'fire_event')
      .then((r) => (r.error ? -1 : (r.count ?? 0))),
  ])

  console.log(
    JSON.stringify(
      {
        supabase_admin_records: adminCount,
        supabase_settlements: settlementCount,
        fire_event_contexts: contextCount,
        jobs,
        runtime_strategy:
          adminCount >= 40
            ? 'supabase_primary'
            : 'local_json_fallback_development_only',
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
