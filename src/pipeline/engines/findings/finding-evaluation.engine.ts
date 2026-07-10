import { compositeFindingEngine } from '@/modules/findings/engine/composite-finding.engine'
import { defaultRuleSetVersion } from '@/modules/findings/findings-context-version'
import type { FindingEvaluationResult } from '@/modules/findings/findings.types'
import { loadFireFindingEvaluationContext } from '@/modules/findings/services/fire-finding-context.loader'
import { persistFindingEvaluation } from '@/pipeline/stores/composite-findings.store'

export async function runFindingEvaluationForEvent(
  eventId: string,
): Promise<FindingEvaluationResult | null> {
  const ctx = await loadFireFindingEvaluationContext(eventId)
  if (!ctx) return null

  const partial = compositeFindingEngine.evaluateFireEventContext(ctx)
  const persisted = await persistFindingEvaluation({
    ...partial,
    findings_created: 0,
    findings_updated: 0,
    findings_resolved: 0,
    duration_ms: partial.duration_ms ?? 0,
  })

  return {
    ...partial,
    ...persisted,
  }
}

export async function listFireEventCandidatesForFindings(limit = 10000): Promise<
  Array<{ id: string; department_name: string | null }>
> {
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client')
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_events')
    .select('id, geo_departments!fire_events_department_id_fkey (name)')
    .order('last_detected_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const deptRaw = row.geo_departments as { name?: string } | { name?: string }[] | null
    const dept = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw
    return { id: String(row.id), department_name: dept?.name ?? null }
  })
}

export function resolveFindingRuleSetVersion(): string {
  return defaultRuleSetVersion()
}
