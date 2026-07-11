import type { RequestAuthContext } from '@/core/auth/permissions'
import { AuthorizationError } from '@/core/auth/permissions'
import { assertSafeExecutivePayload } from '@/modules/executive-demo/copy-guard/executive-copy-guard'
import {
  DEMO_DISCLAIMER,
  isInternalDemoIncidentId,
  isInternalDemoMissionTitle,
} from '@/modules/executive-demo/demo-config'
import {
  DECISIONS_EMPTY,
  RESPONSE_ASSESSMENTS_EMPTY,
  RESOLUTIONS_EMPTY,
  VALIDATIONS_EMPTY,
} from '@/modules/executive-demo/narrative/empty-states'
import { scoreIncidentCoverage } from '@/modules/executive-demo/narrative/story-coverage'
import {
  assertNeverAutoVerified,
  resolveIncidentReportClassification,
} from '@/modules/executive-demo/narrative/report-classification'
import type {
  IncidentStoryDto,
  NationalTimelineEntry,
  StoryStageEntry,
} from '@/modules/executive-demo/types/executive-demo.types'
import { getIncidentById } from '@/pipeline/stores/incidents.store.js'
import { listEvidenceSubmissionsByIncident } from '@/pipeline/stores/evidence-intake.store.js'
import { listCompositeFindings } from '@/pipeline/stores/composite-findings.store.js'
import { listMissions } from '@/pipeline/stores/missions.store.js'
import { listVerificationNeedsForPlan } from '@/pipeline/stores/verification-plans.store.js'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'
import { getIncidentDetail } from './incidents.service.js'

export async function authorizeIncidentStoryAccess(
  auth: RequestAuthContext,
  incidentId: string,
  includeDemo: boolean,
): Promise<void> {
  if (auth.isPlatformAdmin) return
  const incident = await getIncidentById(incidentId)
  if (!incident) throw new AuthorizationError('Incidente no encontrado', 404)
  if (incident.organization_id && incident.organization_id === auth.activeOrganizationId) return
  if (includeDemo && isInternalDemoIncidentId(incidentId)) return
  throw new AuthorizationError('Acceso al incidente denegado', 403)
}

export async function getIncidentStory(
  incidentId: string,
  options: { include_demo?: boolean } = {},
): Promise<IncidentStoryDto | null> {
  const detail = await getIncidentDetail(incidentId)
  if (!detail) return null

  const incident = await getIncidentById(incidentId)
  const isLegacy = incident?.organization_id == null
  const isInternalDemo = isInternalDemoIncidentId(incidentId)
  const coverage = await scoreIncidentCoverage(incidentId)

  const includeDemo = options.include_demo === true
  const classification = assertNeverAutoVerified(
    resolveIncidentReportClassification({
      includeDemo,
      isInternalDemo,
      isLegacy,
      presentStages: coverage.present_stages,
      totalStages: coverage.total_stages,
    }),
  )

  const stages: StoryStageEntry[] = []
  const timeline: NationalTimelineEntry[] = []
  let order = 1

  const primaryEventId = String(detail.primary_event_id ?? '')
  const members = (detail.members as Array<Record<string, unknown>>) ?? []

  stages.push({
    key: 'detection',
    title: 'Detección inicial',
    order: order++,
    epistemic: 'observed',
    status: detail.first_observed_at ? 'present' : 'missing',
    timestamp: detail.first_observed_at ? String(detail.first_observed_at) : null,
    source: 'Correlación TerraMind',
    confidence: 'observado',
    summary: detail.first_observed_at
      ? `Primera observación registrada · ${detail.event_count} evento(s) vinculado(s)`
      : 'Sin timestamp de primera observación',
    detail: typeof detail.correlation_summary === 'string' ? detail.correlation_summary : detail.correlation_summary ? JSON.stringify(detail.correlation_summary) : null,
    href: null,
    items: [],
  })

  stages.push({
    key: 'observations',
    title: 'Observaciones de fuente',
    order: order++,
    epistemic: 'observed',
    status: members.length > 0 ? 'present' : 'missing',
    timestamp: members[0]?.last_detected_at ? String(members[0].last_detected_at) : null,
    source: 'NASA FIRMS',
    confidence: 'observado',
    summary:
      members.length > 0
        ? `${members.length} membresía(s) de evento en el incidente`
        : 'Sin eventos miembro correlacionados',
    detail: null,
    href: primaryEventId ? `/incendios/${primaryEventId}` : null,
    items: members,
  })

  if (primaryEventId) {
    timeline.push({
      id: primaryEventId,
      timestamp: String(detail.last_observed_at ?? detail.first_observed_at),
      stage: 'event',
      stage_label: 'Evento',
      status: String(detail.status),
      source: 'FIRMS clustering',
      confidence: 'inferido',
      summary: `Evento primario ${primaryEventId.slice(0, 8)}…`,
      epistemic: 'inferred',
      href: `/incendios/${primaryEventId}`,
    })
  }

  stages.push({
    key: 'event',
    title: 'Evento',
    order: order++,
    epistemic: 'inferred',
    status: primaryEventId ? 'present' : 'missing',
    timestamp: detail.last_observed_at ? String(detail.last_observed_at) : null,
    source: 'Motor de eventos térmicos',
    confidence: 'inferido',
    summary: primaryEventId ? 'Evento térmico primario identificado' : 'Evento no disponible',
    detail: null,
    href: primaryEventId ? `/incendios/${primaryEventId}` : null,
    items: [],
  })

  const findings = primaryEventId
    ? await listCompositeFindings({ entity_type: 'fire_event', entity_id: primaryEventId, limit: 10 })
    : []
  stages.push({
    key: 'findings',
    title: 'Hallazgos',
    order: order++,
    epistemic: 'inferred',
    status: findings.length > 0 ? 'present' : 'missing',
    timestamp: findings[0] ? String(findings[0].generated_at) : null,
    source: 'Motor de hallazgos compuestos',
    confidence: findings[0] ? String((findings[0].confidence as { level?: string })?.level ?? 'insufficient') : null,
    summary: findings.length > 0 ? `${findings.length} hallazgo(s) vinculado(s)` : 'Sin hallazgos para el evento primario',
    detail: null,
    href: findings[0] ? `/hallazgos/${findings[0].id}` : '/hallazgos',
    items: findings.map((f) => ({ id: f.id, title: f.title, severity: f.severity_label })),
  })

  const admin = getSupabaseAdmin()
  const { data: priorityRow } = primaryEventId
    ? await admin
        .from('finding_priority_assessments')
        .select('id, attention_level, action_level, generated_at')
        .eq('entity_type', 'fire_event')
        .eq('entity_id', primaryEventId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null }

  stages.push({
    key: 'priority',
    title: 'Prioridad',
    order: order++,
    epistemic: 'inferred',
    status: priorityRow ? 'present' : 'missing',
    timestamp: priorityRow?.generated_at ? String(priorityRow.generated_at) : null,
    source: 'Motor de priorización',
    confidence: 'inferido',
    summary: priorityRow
      ? `Atención ${String(priorityRow.attention_level)} · Acción ${String(priorityRow.action_level)}`
      : `Agregado en incidente: atención ${String(detail.attention_level)}`,
    detail: typeof detail.priority_explanation === 'string' ? detail.priority_explanation : null,
    href: priorityRow ? `/prioridades/${priorityRow.id}` : null,
    items: priorityRow ? [priorityRow] : [],
  })

  const { data: lifecycleRows } = primaryEventId
    ? await admin
        .from('event_lifecycle_transitions')
        .select('id, to_state, transitioned_at')
        .eq('entity_type', 'fire_event')
        .eq('entity_id', primaryEventId)
        .order('transitioned_at', { ascending: false })
        .limit(5)
    : { data: [] }

  stages.push({
    key: 'lifecycle',
    title: 'Lifecycle',
    order: order++,
    epistemic: 'inferred',
    status: (lifecycleRows?.length ?? 0) > 0 ? 'present' : 'missing',
    timestamp: lifecycleRows?.[0]?.transitioned_at ? String(lifecycleRows[0].transitioned_at) : null,
    source: 'Motor lifecycle',
    confidence: 'inferido',
    summary:
      (lifecycleRows?.length ?? 0) > 0
        ? `Estado actual miembro: ${String(members[0]?.lifecycle_state ?? 'n/d')}`
        : 'Sin transiciones lifecycle registradas',
    detail: null,
    href: null,
    items: lifecycleRows ?? [],
  })

  stages.push({
    key: 'incident',
    title: 'Correlación del incidente',
    order: order++,
    epistemic: 'inferred',
    status: 'present',
    timestamp: String(detail.last_observed_at ?? detail.first_observed_at),
    source: 'Motor de correlación',
    confidence: 'inferido',
    summary: `${String(detail.incident_type)} · ${String(detail.status)} · ${detail.event_count} evento(s)`,
    detail: isLegacy ? 'Incidente legacy sin organization_id asignado' : null,
    href: `/incidentes/${incidentId}`,
    items: [],
  })

  const { data: planRows } = await admin
    .from('verification_plans')
    .select('*')
    .eq('incident_id', incidentId)
    .limit(5)
  const plans = planRows ?? []
  const needs = plans[0] ? await listVerificationNeedsForPlan(String(plans[0].id)) : []

  stages.push({
    key: 'verification_questions',
    title: 'Preguntas de verificación',
    order: order++,
    epistemic: 'recommended',
    status: needs.length > 0 ? 'present' : 'missing',
    timestamp: null,
    source: 'Plan de verificación',
    confidence: 'recomendado',
    summary: needs.length > 0 ? `${needs.length} necesidad(es) de verificación` : 'Sin necesidades explícitas — revisar plan',
    detail: null,
    href: '/verificaciones',
    items: needs,
  })

  stages.push({
    key: 'verification_plan',
    title: 'Verification plan',
    order: order++,
    epistemic: 'recommended',
    status: plans.length > 0 ? 'present' : 'missing',
    timestamp: plans[0]?.updated_at ? String(plans[0].updated_at) : null,
    source: 'Motor de verificación',
    confidence: 'recomendado',
    summary: plans.length > 0 ? `Plan ${String(plans[0].status)}` : 'No generado todavía',
    detail: null,
    href: '/verificaciones',
    items: plans,
  })

  const missions = await listMissions({ incident_id: incidentId, limit: 10 })
  const demoMissions = missions.filter((m) => isInternalDemoMissionTitle(String(m.title)))

  stages.push({
    key: 'missions',
    title: 'Misiones',
    order: order++,
    epistemic: 'decided',
    status: missions.length > 0 ? 'present' : 'missing',
    timestamp: missions[0]?.updated_at ? String(missions[0].updated_at) : null,
    source: 'Operaciones de campo',
    confidence: 'observado',
    summary:
      missions.length > 0
        ? `${missions.length} misión(es)${demoMissions.length > 0 ? ' · incluye piloto interno' : ''}`
        : 'No generado todavía — requiere plan de verificación aprobado',
    detail: demoMissions.length > 0 ? DEMO_DISCLAIMER : null,
    href: missions[0] ? `/misiones/${missions[0].id}` : '/misiones',
    items: missions.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.status,
      is_internal_demo: isInternalDemoMissionTitle(String(m.title)),
    })),
  })

  const evidence = await listEvidenceSubmissionsByIncident(incidentId)
  stages.push({
    key: 'evidence',
    title: 'Evidencia',
    order: order++,
    epistemic: 'observed',
    status: evidence.length > 0 ? 'present' : 'missing',
    timestamp: evidence[0]?.submitted_at ? String(evidence[0].submitted_at) : null,
    source: 'Captura de campo',
    confidence: 'observado',
    summary:
      evidence.length > 0
        ? `${evidence.length} envío(s) · estado ${String(evidence[0].status)}`
        : 'No generado todavía — requiere misión activa y captura en campo',
    detail: null,
    href: evidence[0] ? `/misiones/${evidence[0].mission_id}` : null,
    items: evidence,
  })

  stages.push({
    key: 'validation',
    title: 'Validación',
    order: order++,
    epistemic: 'verified',
    status: 'missing',
    timestamp: null,
    source: 'Motor de validación',
    confidence: null,
    summary: VALIDATIONS_EMPTY.why_empty,
    detail: VALIDATIONS_EMPTY.fed_by,
    href: null,
    items: [],
    empty_state: VALIDATIONS_EMPTY,
  })

  stages.push({
    key: 'resolution',
    title: 'Resolución',
    order: order++,
    epistemic: 'verified',
    status: 'missing',
    timestamp: null,
    source: 'Motor de resolución',
    confidence: null,
    summary: RESOLUTIONS_EMPTY.why_empty,
    detail: RESOLUTIONS_EMPTY.fed_by,
    href: null,
    items: [],
    empty_state: RESOLUTIONS_EMPTY,
  })

  stages.push({
    key: 'reevaluations',
    title: 'Reevaluaciones',
    order: order++,
    epistemic: 'inferred',
    status: 'missing',
    timestamp: null,
    source: 'Pipeline downstream',
    confidence: null,
    summary: 'Pendiente de resolución completada',
    detail: null,
    href: null,
    items: [],
  })

  stages.push({
    key: 'response',
    title: 'Respuesta recomendada',
    order: order++,
    epistemic: 'recommended',
    status: isLegacy ? 'blocked' : 'missing',
    timestamp: null,
    source: 'Response Orchestration 8C.1',
    confidence: null,
    summary: isLegacy
      ? 'Ownership sin resolver — no se genera assessment sobre incidente legacy'
      : RESPONSE_ASSESSMENTS_EMPTY.why_empty,
    detail: null,
    href: `/respuesta/${incidentId}`,
    items: [],
    empty_state: RESPONSE_ASSESSMENTS_EMPTY,
  })

  stages.push({
    key: 'decision',
    title: 'Decisión',
    order: order++,
    epistemic: 'decided',
    status: 'missing',
    timestamp: null,
    source: 'Flujo humano',
    confidence: null,
    summary: DECISIONS_EMPTY.why_empty,
    detail: null,
    href: `/respuesta/${incidentId}`,
    items: [],
    empty_state: DECISIONS_EMPTY,
  })

  stages.push({
    key: 'actions',
    title: 'Acciones y próximos pasos',
    order: order++,
    epistemic: 'executed',
    status: missions.length > 0 ? 'present' : 'missing',
    timestamp: null,
    source: 'Operaciones',
    confidence: 'recomendado',
    summary:
      missions.length > 0
        ? 'Continuar verificación de campo y validación de evidencia recibida'
        : 'Activar plan de verificación y asignar misión de campo',
    detail: isInternalDemo ? DEMO_DISCLAIMER : null,
    href: `/incidentes/${incidentId}`,
    items: [],
  })

  for (const s of stages) {
    if (s.timestamp) {
      timeline.push({
        id: `${incidentId}-${s.key}`,
        timestamp: s.timestamp,
        stage: s.key,
        stage_label: s.title,
        status: s.status,
        source: s.source ?? '',
        confidence: s.confidence ?? '',
        summary: s.summary,
        epistemic: s.epistemic,
        href: s.href ?? undefined,
        is_internal_demo: isInternalDemo,
      })
    }
  }
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const story: IncidentStoryDto = {
    incident_id: incidentId,
    generated_at: new Date().toISOString(),
    is_internal_demo: isInternalDemo,
    is_legacy: isLegacy,
    classification,
    coverage,
    stages,
    timeline,
  }

  assertSafeExecutivePayload(story)
  return story
}
