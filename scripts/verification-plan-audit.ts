#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const supabase = getSupabaseAdmin()
  const { data: plans } = await supabase
    .from('verification_plans')
    .select('id, incident_id, status, plan_priority, needs_count:verification_needs(count)')
    .in('status', ['draft', 'ready', 'not_required', 'blocked'])
    .order('plan_priority', { ascending: false })
    .limit(20)

  const { data: needs } = await supabase
    .from('verification_needs')
    .select('need_type, recommended_method_id, plan_id')
    .order('priority', { ascending: false })
    .limit(50)

  console.log(
    JSON.stringify(
      {
        active_plans: plans ?? [],
        recent_needs: needs ?? [],
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
