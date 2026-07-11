import type { RequestAuthContext } from '@/core/auth/permissions'
import { assertSafeExecutivePayload } from '@/modules/executive-demo/copy-guard/executive-copy-guard'
import {
  INTERNAL_DEMO_INCIDENT_ID,
  isInternalDemoIncidentId,
  isInternalDemoMissionTitle,
} from '@/modules/executive-demo/demo-config'
import {
  buildDataAudit,
  buildExecutiveSummary,
  collectEmptySections,
} from '@/modules/executive-demo/narrative/executive-summary.builder'
import {
  DECISIONS_EMPTY,
  RESPONSE_ASSESSMENTS_EMPTY,
  RESOLUTIONS_EMPTY,
  VALIDATIONS_EMPTY,
} from '@/modules/executive-demo/narrative/empty-states'
import { findBestCoverageIncidentId, scoreIncidentCoverage } from '@/modules/executive-demo/narrative/story-coverage'
import type {
  ExecutiveDashboardDto,
  NationalTimelineEntry,
  StageAuditEntry,
} from '@/modules/executive-demo/types/executive-demo.types'
import { listCompositeFindings } from '@/pipeline/stores/composite-findings.store.js'
import { listIncidents } from '@/pipeline/stores/incidents.store.js'
import { listMissions } from '@/pipeline/stores/missions.store.js'
import { listVerificationPlans } from '@/pipeline/stores/verification-plans.store.js'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'
import { filterRowsByActiveOrganization } from '../auth/tenant-list-scope.js'
import { getSituationReport } from '@/pipeline/orchestrator'

async function countMissionsForDashboard(includeDemo: boolean): Promise<number> {
  const missions = await listMissions({ limit: 500 })
  if (includeDemo) return missions.length
  return missions.filter((m) => !isInternalDemoMissionTitle(String(m.title))).length
}

async function countEvidenceForDashboard(includeDemo: boolean): Promise<number> {
  const admin = getSupabaseAdmin()
  const missions = await listMissions({ limit: 500 })
  const pilotMissionIds = new Set(
    missions
      .filter((m) => isInternalDemoMissionTitle(String(m.title)))
      .map((m) => String(m.id)),
  )
  if (includeDemo || pilotMissionIds.size === 0) {
    return countTable('evidence_submissions')
  }
  const { data: rows } = await admin.from('evidence_submissions').select('id, mission_id')
  return (rows ?? []).filter((r) => !pilotMissionIds.has(String(r.mission_id))).length
}

function filterEvidenceRows<T extends { mission_id: unknown }>(
  rows: T[],
  includeDemo: boolean,
  pilotMissionIds: Set<string>,
): T[] {
  if (includeDemo) return rows
  return rows.filter((r) => !pilotMissionIds.has(String(r.mission_id)))
}

async function countTable(table: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from(table)
    .select('id', { head: true, count: 'exact' })
  if (error) return 0
  return count ?? 0
}

async function loadStageCounts(): Promise<Record<string, number>> {
  const admin = getSupabaseAdmin()
  const pairs: Array<[string, string]> = [
    ['fire_detections', 'fire_detections'],
    ['fire_events', 'fire_events'],
    ['composite_findings', 'composite_findings'],
    ['finding_priority_assessments', 'finding_priority_assessments'],
    ['incidents_total', 'incidents'],
    ['event_lifecycle_transitions', 'event_lifecycle_transitions'],
    ['verification_plans', 'verification_plans'],
    ['verification_needs', 'verification_needs'],
    ['missions', 'missions'],
    ['evidence_submissions', 'evidence_submissions'],
    ['evidence_validations', 'evidence_validations'],
    ['verification_need_resolutions', 'verification_need_resolutions'],
    ['response_assessments', 'response_assessments'],
    ['decision_records', 'decision_records'],
    ['response_actions', 'response_actions'],
  ]
  const out: Record<string, number> = {}
  for (const [key, table] of pairs) {
    out[key] = await countTable(table)
  }
  const { count: tenant } = await admin
    .from('incidents')
    .select('id', { head: true, count: 'exact' })
    .not('organization_id', 'is', null)
  const { count: legacy } = await admin
    .from('incidents')
    .select('id', { head: true, count: 'exact' })
    .is('organization_id', null)
  out.incidents_tenant = tenant ?? 0
  out.incidents_legacy = legacy ?? 0
  return out
}


export async function getExecutiveDashboard(
  auth: RequestAuthContext,
  options: { include_demo?: boolean } = {},
): Promise<ExecutiveDashboardDto> {
  const includeDemo = options.include_demo === true
  const counts = await loadStageCounts()
  const dataAudit = buildDataAudit(counts)
  const situation = getSituationReport()

  const findingsRows = await listCompositeFindings({ limit: 8, status: 'active' })
  const priorityFindings = findingsRows.slice(0, 5).map((f) => ({
    id: String(f.id),
    title: String(f.title),
    severity_label: String(f.severity_label),
    department_name: (f.geographic_context?.department_name as string | null) ?? null,
    href: `/hallazgos/${f.id}`,
  }))

  let incidents = await listIncidents({ limit: 20 })
  if (!auth.isPlatformAdmin) {
    incidents = filterRowsByActiveOrganization(auth, incidents as Array<{ organization_id?: string | null }>)
  }
  if (!includeDemo) {
    incidents = incidents.filter((i) => i.organization_id != null && !isInternalDemoIncidentId(String(i.id)))
  }

  const activeIncidents = await Promise.all(
    incidents.slice(0, 8).map(async (inc) => {
      const id = String(inc.id)
      const coverage = await scoreIncidentCoverage(id)
      const isLegacy = inc.organization_id == null
      return {
        id,
        status: String(inc.status),
        attention_level: String(inc.attention_level ?? 'unknown'),
        event_count: Number(inc.event_count ?? 0),
        is_legacy: isLegacy,
        is_internal_demo: isInternalDemoIncidentId(id),
        story_coverage: coverage.label,
        href: `/incidentes/${id}`,
        story_href: `/incidentes/${id}/historia`,
      }
    }),
  )

  const plans = await listVerificationPlans({ limit: 10 })
  const scopedPlans = auth.isPlatformAdmin
    ? plans
    : filterRowsByActiveOrganization(auth, plans as Array<{ organization_id?: string | null }>)

  const missions = await listMissions({ limit: 500 })
  let scopedMissions = auth.isPlatformAdmin
    ? missions
    : filterRowsByActiveOrganization(auth, missions as Array<{ organization_id?: string | null }>)
  if (!includeDemo) {
    scopedMissions = scopedMissions.filter((m) => !isInternalDemoMissionTitle(String(m.title)))
  }
  const pilotMissionIds = new Set(
    missions
      .filter((m) => isInternalDemoMissionTitle(String(m.title)))
      .map((m) => String(m.id)),
  )

  const admin = getSupabaseAdmin()
  const { data: evidenceRowsRaw } = await admin
    .from('evidence_submissions')
    .select('id, status, mission_id')
    .order('created_at', { ascending: false })
    .limit(5)
  const evidenceRows = filterEvidenceRows(evidenceRowsRaw ?? [], includeDemo, pilotMissionIds)

  const missionMetricCount = await countMissionsForDashboard(includeDemo)
  const evidenceMetricCount = await countEvidenceForDashboard(includeDemo)
  const incidentMetricCount = includeDemo ? counts.incidents_total : counts.incidents_tenant

  const timeline = await buildNationalTimeline(includeDemo, auth)

  const responseRecommendations: ExecutiveDashboardDto['response_recommendations'] = []
  const pendingDecisions: ExecutiveDashboardDto['pending_decisions'] = []
  if (auth.permissions.includes('responses.view')) {
    const { listAssessmentsForOrganization } = await import('@/pipeline/stores/response-orchestration.store.js')
    const assessments = await listAssessmentsForOrganization(auth.activeOrganizationId)
    for (const a of assessments.slice(0, 5)) {
      responseRecommendations.push({
        incident_id: String(a.incident_id),
        recommended_level: String(a.recommended_response_level),
        href: `/respuesta/${a.incident_id}`,
      })
    }
    const { data: decisions } = await admin
      .from('decision_records')
      .select('incident_id, decision_status')
      .eq('organization_id', auth.activeOrganizationId)
      .in('decision_status', ['recommended', 'pending_approval'])
      .limit(5)
    for (const d of decisions ?? []) {
      pendingDecisions.push({
        incident_id: String(d.incident_id),
        decision_status: String(d.decision_status),
        href: `/respuesta/${d.incident_id}`,
      })
    }
  }

  const summary = buildExecutiveSummary({
    fireEvents: counts.fire_events,
    findings: counts.composite_findings,
    incidents: counts.incidents_total,
    tenantIncidents: counts.incidents_tenant,
    missions: counts.missions,
    evidence: counts.evidence_submissions,
    validations: counts.evidence_validations,
    resolutions: counts.verification_need_resolutions,
    assessments: counts.response_assessments,
    decisions: counts.decision_records,
    systemStatus: situation.systemStatus,
  })

  const dashboard: ExecutiveDashboardDto = {
    generated_at: new Date().toISOString(),
    system_status: situation.systemStatus,
    last_sync_at: situation.lastSyncAt ?? null,
    sources_active: situation.sourcesActive,
    include_demo: includeDemo,
    metrics: [
      { key: 'observations', label: 'Observaciones FIRMS', value: counts.fire_detections },
      { key: 'events', label: 'Eventos térmicos', value: counts.fire_events, href: '/incendios' },
      { key: 'findings', label: 'Hallazgos', value: counts.composite_findings, href: '/hallazgos' },
      { key: 'incidents', label: 'Incidentes', value: incidentMetricCount, href: '/incidentes' },
      { key: 'missions', label: 'Misiones', value: missionMetricCount, href: '/misiones' },
      { key: 'evidence', label: 'Evidencia', value: evidenceMetricCount },
      {
        key: 'responses',
        label: 'Respuestas',
        value: counts.response_assessments,
        href: '/respuesta',
        empty: counts.response_assessments === 0 ? RESPONSE_ASSESSMENTS_EMPTY : undefined,
      },
    ],
    summary,
    priority_findings: priorityFindings,
    active_incidents: activeIncidents,
    recent_changes: timeline.slice(0, 20),
    pending_verifications: scopedPlans.slice(0, 5).map((p) => ({
      id: String(p.id),
      incident_id: String(p.incident_id),
      status: String(p.status),
      href: `/verificaciones?incident=${p.incident_id}`,
    })),
    missions_in_progress: scopedMissions.slice(0, 5).map((m) => ({
      id: String(m.id),
      title: String(m.title),
      status: String(m.status),
      is_internal_demo: isInternalDemoMissionTitle(String(m.title)),
      href: `/misiones/${m.id}`,
    })),
    recent_evidence: evidenceRows.map((e) => ({
      id: String(e.id),
      status: String(e.status),
      mission_id: String(e.mission_id),
      href: `/misiones/${e.mission_id}`,
    })),
    recent_resolutions: [],
    response_recommendations: responseRecommendations,
    pending_decisions: pendingDecisions,
    empty_sections: [],
    data_audit: dataAudit,
    recommended_demo_incident_id:
      (await findBestCoverageIncidentId(includeDemo)) ?? INTERNAL_DEMO_INCIDENT_ID,
  }

  if (dashboard.recent_resolutions.length === 0) dashboard.empty_sections.push(RESOLUTIONS_EMPTY)
  if (counts.evidence_validations === 0) dashboard.empty_sections.push(VALIDATIONS_EMPTY)
  if (counts.response_assessments === 0) dashboard.empty_sections.push(RESPONSE_ASSESSMENTS_EMPTY)
  if (counts.decision_records === 0) dashboard.empty_sections.push(DECISIONS_EMPTY)
  dashboard.empty_sections.push(...collectEmptySections(dashboard))

  assertSafeExecutivePayload(dashboard)
  return dashboard
}

export async function getDataAuditReport(): Promise<{ audit: StageAuditEntry[]; generated_at: string }> {
  const counts = await loadStageCounts()
  return { audit: buildDataAudit(counts), generated_at: new Date().toISOString() }
}

async function buildNationalTimeline(
  includeDemo: boolean,
  auth: RequestAuthContext,
): Promise<NationalTimelineEntry[]> {
  const admin = getSupabaseAdmin()
  const entries: NationalTimelineEntry[] = []

  const { data: detections } = await admin
    .from('fire_detections')
    .select('id, detected_at, confidence')
    .order('detected_at', { ascending: false })
    .limit(5)
  for (const d of detections ?? []) {
    entries.push({
      id: String(d.id),
      timestamp: String(d.detected_at),
      stage: 'observation',
      stage_label: 'Observación',
      status: 'detected',
      source: 'NASA FIRMS',
      confidence: String(d.confidence ?? 'n/a'),
      summary: 'Detección térmica registrada',
      epistemic: 'observed',
      href: '/incendios',
    })
  }

  const { data: events } = await admin
    .from('fire_events')
    .select('id, last_detected_at, validation_status')
    .order('last_detected_at', { ascending: false })
    .limit(5)
  for (const e of events ?? []) {
    entries.push({
      id: String(e.id),
      timestamp: String(e.last_detected_at),
      stage: 'event',
      stage_label: 'Evento',
      status: String(e.validation_status ?? 'unknown'),
      source: 'Motor de clustering FIRMS',
      confidence: 'inferido',
      summary: 'Evento térmico agrupado',
      epistemic: 'inferred',
      href: `/incendios/${e.id}`,
      entity_id: String(e.id),
    })
  }

  const findings = await listCompositeFindings({ limit: 5 })
  for (const f of findings) {
    entries.push({
      id: String(f.id),
      timestamp: String(f.generated_at),
      stage: 'finding',
      stage_label: 'Hallazgo',
      status: String(f.status),
      source: f.source_domains.join(', '),
      confidence: (f.confidence as { level?: string })?.level ?? 'insufficient',
      summary: String(f.title),
      epistemic: 'inferred',
      href: `/hallazgos/${f.id}`,
    })
  }

  let incidents = await listIncidents({ limit: 5 })
  if (!includeDemo) {
    incidents = incidents.filter(
      (i) => i.organization_id != null && !isInternalDemoIncidentId(String(i.id)),
    )
  }
  for (const inc of incidents) {
    entries.push({
      id: String(inc.id),
      timestamp: String(inc.last_observed_at ?? inc.first_observed_at),
      stage: 'incident',
      stage_label: 'Incidente',
      status: String(inc.status),
      source: 'Correlación de incidentes',
      confidence: 'inferido',
      summary: `Incidente ${String(inc.incident_type)} · ${inc.event_count} evento(s)`,
      epistemic: 'inferred',
      href: `/incidentes/${inc.id}`,
      is_internal_demo: isInternalDemoIncidentId(String(inc.id)),
    })
  }

  const missions = await listMissions({ limit: 5 })
  for (const m of missions) {
    const demo = isInternalDemoMissionTitle(String(m.title))
    if (!includeDemo && demo) continue
    entries.push({
      id: String(m.id),
      timestamp: String(m.updated_at ?? m.created_at),
      stage: 'mission',
      stage_label: 'Misión',
      status: String(m.status),
      source: 'Operaciones de campo',
      confidence: 'observado',
      summary: String(m.title),
      epistemic: 'observed',
      href: `/misiones/${m.id}`,
      is_internal_demo: demo,
    })
  }

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  return entries
}
