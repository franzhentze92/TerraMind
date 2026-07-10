#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { compositeFindingEngine } from '@/modules/findings/engine/composite-finding.engine'
import { loadFireFindingEvaluationContext } from '@/modules/findings/services/fire-finding-context.loader'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

const HIGHLIGHT = ['Retalhuleu', 'Sacatepéquez', 'Escuintla', 'Jutiapa', 'Petén', 'Peten']

async function main() {
  const supabase = getSupabaseAdmin()
  const { data: events, error } = await supabase
    .from('fire_events')
    .select('id, geo_departments!fire_events_department_id_fkey (name)')
    .order('id')

  if (error) throw new Error(error.message)

  const report = []
  for (const event of events ?? []) {
    const deptRaw = event.geo_departments as { name?: string } | { name?: string }[] | null
    const dept = (Array.isArray(deptRaw) ? deptRaw[0] : deptRaw)?.name ?? null
    const ctx = await loadFireFindingEvaluationContext(String(event.id))
    if (!ctx) continue

    const evaluation = compositeFindingEngine.evaluateFireEventContext(ctx)
    const triggered = evaluation.rule_results.filter((r) => r.status === 'triggered')

    report.push({
      event_id: event.id,
      department: dept,
      highlighted: HIGHLIGHT.some((h) => dept?.includes(h)),
      rules_evaluable: evaluation.rule_results.filter((r) => r.status !== 'not_evaluable').length,
      rules_triggered: triggered.length,
      triggered_rules: triggered.map((r) => r.rule_code),
      findings: evaluation.findings.map((f) => ({
        type: f.finding_type,
        title: f.title,
        severity: f.severity_label,
        confidence: f.confidence.level,
        limitations_count: f.limitations.length,
        actions_count: f.recommended_actions.length,
      })),
      warnings: evaluation.warnings,
      context_version: evaluation.context_version,
    })
  }

  console.log(
    JSON.stringify(
      {
        events_audited: report.length,
        total_findings: report.reduce((s, r) => s + r.findings.length, 0),
        highlighted: report.filter((r) => r.highlighted),
        all: report,
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
