#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { firePriorityEngine } from '@/modules/priorities/engine/fire-priority.engine'
import {
  loadActiveFindingsForPriority,
  loadFirePriorityEvaluationContext,
} from '@/modules/priorities/services/fire-priority-context.loader'
import { listFireEventCandidatesForPriority } from '@/pipeline/engines/priorities/priority-evaluation.engine'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const candidates = await listFireEventCandidatesForPriority(10000)
  const results = []

  for (const event of candidates) {
    const ctx = await loadFirePriorityEvaluationContext(event.id)
    if (!ctx) continue
    const findings = await loadActiveFindingsForPriority(event.id)
    const evaluation = firePriorityEngine.evaluateFireEventPriority({
      entity_type: 'fire_event',
      entity_id: event.id,
      event: ctx,
      findings,
      evaluated_at: new Date().toISOString(),
    })

    results.push({
      event_id: event.id,
      department: event.department_name,
      findings_count: evaluation.findings_count,
      attention_score: evaluation.assessment.attention_score,
      attention_level: evaluation.assessment.attention_level,
      verification_score: evaluation.assessment.verification_score,
      verification_level: evaluation.assessment.verification_level,
      action_score: evaluation.assessment.action_score,
      action_level: evaluation.assessment.action_level,
      priority_reasons: evaluation.assessment.priority_reasons,
      dominant_domains: Object.entries(evaluation.assessment.domain_contributions)
        .filter(([, v]) => Number(v) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .map(([k]) => k),
      discarded: evaluation.assessment.score_explanation.discarded_by_redundancy,
      warnings: evaluation.warnings,
    })
  }

  results.sort((a, b) => b.attention_score - a.attention_score)

  console.log(
    JSON.stringify(
      {
        events_audited: results.length,
        queue: results,
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
