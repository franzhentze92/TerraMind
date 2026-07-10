#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { genericLifecycleEngine } from '@/modules/lifecycle/engine/generic-lifecycle.engine'
import { loadFireLifecycleSnapshot } from '@/modules/lifecycle/services/fire-lifecycle-snapshot.loader'
import { listFireEventCandidatesForLifecycle } from '@/modules/lifecycle/services/fire-lifecycle-snapshot.loader'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const candidates = await listFireEventCandidatesForLifecycle(10000)
  const evaluatedAt = new Date().toISOString()
  const results = []

  for (const event of candidates) {
    const snapshot = await loadFireLifecycleSnapshot(event.id)
    if (!snapshot) continue
    const evaluation = genericLifecycleEngine.evaluate({ snapshot, evaluatedAt })
    results.push({
      event_id: event.id,
      previous_state: evaluation.previous_state,
      new_state: evaluation.new_state,
      transitioned: evaluation.transitioned,
      transition_rule: evaluation.transition_rule,
      transition_reason: evaluation.transition_reason,
      correlation_kind: evaluation.correlation_kind,
      detection_count: snapshot.detection_count,
      context_signature: evaluation.context_signature,
    })
  }

  results.sort((a, b) => a.event_id.localeCompare(b.event_id))

  console.log(
    JSON.stringify(
      {
        events_audited: results.length,
        lifecycle_model_version: genericLifecycleEngine.modelVersion,
        evaluated_at: evaluatedAt,
        events: results,
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
