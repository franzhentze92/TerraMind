import type { RequestAuthContext } from '@/core/auth/permissions'
import { isInternalDemoMissionTitle } from '@/modules/executive-demo/demo-config'
import { buildOperationalPeriodComparison } from '@/modules/national-situation/utils/operational-period-comparison'
import type { OperationalPeriodComparison } from '@/modules/national-situation/utils/operational-period-comparison'
import { listMissions } from '@/pipeline/stores/missions.store.js'
import { listVerificationPlans } from '@/pipeline/stores/verification-plans.store.js'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'
import { filterRowsByActiveOrganization } from '../auth/tenant-list-scope.js'

export async function buildOperationalPeriodComparisonForDashboard(
  auth: RequestAuthContext,
  periodHours: number,
  includeDemo: boolean,
): Promise<OperationalPeriodComparison> {
  const admin = getSupabaseAdmin()

  let plans = await listVerificationPlans({ limit: 500 })
  if (!auth.isPlatformAdmin) {
    plans = filterRowsByActiveOrganization(
      auth,
      plans as Array<{ organization_id?: string | null }>,
    )
  }

  let missions = await listMissions({ limit: 500 })
  if (!auth.isPlatformAdmin) {
    missions = filterRowsByActiveOrganization(
      auth,
      missions as Array<{ organization_id?: string | null }>,
    )
  }
  if (!includeDemo) {
    missions = missions.filter((m) => !isInternalDemoMissionTitle(String(m.title)))
  }

  const { data: evidenceRows } = await admin
    .from('evidence_submissions')
    .select('id, status, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(500)

  let decisions: Array<{ status: string; created_at: string; updated_at?: string }> = []
  if (auth.permissions.includes('responses.view')) {
    // Only FORMAL human decisions count — automatic recommendations
    // (decision_type = 'system_recommendation') are never pending decisions.
    const { data } = await admin
      .from('decision_records')
      .select('decision_status, decision_type, created_at, updated_at')
      .eq('organization_id', auth.activeOrganizationId)
      .eq('decision_type', 'human_decision')
      .limit(500)
    decisions = (data ?? []).map((d) => ({
      status: String(d.decision_status),
      created_at: String(d.created_at),
      updated_at: d.updated_at ? String(d.updated_at) : undefined,
    }))
  }

  let responses: Array<{ created_at: string; updated_at?: string }> = []
  if (auth.permissions.includes('responses.view')) {
    const { listAssessmentsForOrganization } = await import(
      '@/pipeline/stores/response-orchestration.store.js'
    )
    const assessments = await listAssessmentsForOrganization(auth.activeOrganizationId)
    responses = assessments.map((a) => ({
      created_at: String(a.created_at ?? a.updated_at ?? new Date().toISOString()),
      updated_at: a.updated_at ? String(a.updated_at) : undefined,
    }))
  }

  return buildOperationalPeriodComparison({
    periodHours,
    plans: plans.map((p) => ({
      status: String(p.status),
      created_at: String(p.created_at),
      updated_at: String(p.updated_at),
      superseded_at: p.superseded_at ? String(p.superseded_at) : null,
    })),
    missions: missions.map((m) => ({
      status: String(m.status),
      created_at: String(m.created_at),
      updated_at: String(m.updated_at),
      completed_at: m.completed_at ? String(m.completed_at) : null,
      cancelled_at: m.cancelled_at ? String(m.cancelled_at) : null,
    })),
    evidence: (evidenceRows ?? []).map((e) => ({
      status: String(e.status),
      created_at: String(e.created_at),
      updated_at: e.updated_at ? String(e.updated_at) : undefined,
    })),
    decisions,
    responses,
  })
}
