import type { IncidentStoryCoverage } from '../types/executive-demo.types'

export const STORY_STAGE_KEYS = [
  'event',
  'finding',
  'priority',
  'lifecycle',
  'plan',
  'mission',
  'evidence',
  'resolution',
  'response',
] as const

export type StoryStageKey = (typeof STORY_STAGE_KEYS)[number]

export const STORY_STAGE_LABELS: Record<StoryStageKey, string> = {
  event: 'Evento térmico',
  finding: 'Hallazgo compuesto',
  priority: 'Prioridad',
  lifecycle: 'Ciclo de vida',
  plan: 'Plan de verificación',
  mission: 'Misión de campo',
  evidence: 'Evidencia',
  resolution: 'Resolución',
  response: 'Assessment de respuesta',
}

export function buildStoryCoverage(stages: Record<StoryStageKey, boolean>): IncidentStoryCoverage {
  const presentKeys = STORY_STAGE_KEYS.filter((k) => stages[k])
  const missingKeys = STORY_STAGE_KEYS.filter((k) => !stages[k])
  const present = presentKeys.length

  return {
    total_stages: STORY_STAGE_KEYS.length,
    present_stages: present,
    label: `Cobertura de historia: ${present} de ${STORY_STAGE_KEYS.length} etapas`,
    stages,
    present_stage_labels: presentKeys.map((k) => STORY_STAGE_LABELS[k]),
    missing_stage_labels: missingKeys.map((k) => STORY_STAGE_LABELS[k]),
  }
}

export async function scoreIncidentCoverage(incidentId: string): Promise<IncidentStoryCoverage> {
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const admin = getSupabaseAdmin()

  const { data: incRow } = await admin
    .from('incidents')
    .select('primary_event_id, attention_level')
    .eq('id', incidentId)
    .maybeSingle()
  const eventId = incRow?.primary_event_id as string | null

  let finding = false
  let priority = Boolean(
    incRow?.attention_level && String(incRow.attention_level) !== 'unknown',
  )
  let lifecycle = false

  if (eventId) {
    const { count: fc } = await admin
      .from('composite_findings')
      .select('id', { head: true, count: 'exact' })
      .eq('entity_type', 'fire_event')
      .eq('entity_id', eventId)
    finding = (fc ?? 0) > 0

    if (!priority) {
      const { count: pc } = await admin
        .from('finding_priority_assessments')
        .select('id', { head: true, count: 'exact' })
        .eq('entity_type', 'fire_event')
        .eq('entity_id', eventId)
      priority = (pc ?? 0) > 0
    }

    const { count: lc } = await admin
      .from('event_lifecycle_transitions')
      .select('id', { head: true, count: 'exact' })
      .eq('entity_type', 'fire_event')
      .eq('entity_id', eventId)
    lifecycle = (lc ?? 0) > 0

    if (!lifecycle) {
      const { data: fe } = await admin
        .from('fire_events')
        .select('lifecycle_state')
        .eq('id', eventId)
        .maybeSingle()
      const state = fe?.lifecycle_state ? String(fe.lifecycle_state) : ''
      lifecycle = Boolean(state && state !== 'unknown')
    }
  }

  if (!lifecycle) {
    const { count: memberCount } = await admin
      .from('incident_event_memberships')
      .select('id', { head: true, count: 'exact' })
      .eq('incident_id', incidentId)
    lifecycle = (memberCount ?? 0) > 0 && Boolean(eventId)
  }

  const { count: planCount } = await admin
    .from('verification_plans')
    .select('id', { head: true, count: 'exact' })
    .eq('incident_id', incidentId)
  const { count: missionCount } = await admin
    .from('missions')
    .select('id', { head: true, count: 'exact' })
    .eq('incident_id', incidentId)
  const { count: evidenceCount } = await admin
    .from('evidence_submissions')
    .select('id', { head: true, count: 'exact' })
    .in(
      'mission_id',
      (
        await admin.from('missions').select('id').eq('incident_id', incidentId)
      ).data?.map((m) => m.id as string) ?? ['00000000-0000-4000-a07f-000000000000'],
    )
  const { count: resolutionCount } = await admin
    .from('verification_need_resolutions')
    .select('id', { head: true, count: 'exact' })
    .in(
      'verification_need_id',
      (
        await admin
          .from('verification_needs')
          .select('id')
          .in(
            'verification_plan_id',
            (
              await admin.from('verification_plans').select('id').eq('incident_id', incidentId)
            ).data?.map((p) => p.id as string) ?? ['00000000-0000-4000-a07f-000000000000'],
          )
      ).data?.map((n) => n.id as string) ?? ['00000000-0000-4000-a07f-000000000000'],
    )
  const { count: responseCount } = await admin
    .from('response_assessments')
    .select('id', { head: true, count: 'exact' })
    .eq('incident_id', incidentId)

  return buildStoryCoverage({
    event: Boolean(eventId),
    finding,
    priority,
    lifecycle,
    plan: (planCount ?? 0) > 0,
    mission: (missionCount ?? 0) > 0,
    evidence: (evidenceCount ?? 0) > 0,
    resolution: (resolutionCount ?? 0) > 0,
    response: (responseCount ?? 0) > 0,
  })
}

export async function findBestCoverageIncidentId(includeDemo: boolean): Promise<string | null> {
  const { listIncidents } = await import('@/pipeline/stores/incidents.store.js')
  const rows = await listIncidents({ limit: 50 })
  let best: { id: string; score: number } | null = null
  for (const row of rows) {
    const orgId = (row as { organization_id?: string | null }).organization_id
    if (!includeDemo && orgId == null) continue
    const coverage = await scoreIncidentCoverage(String(row.id))
    if (!best || coverage.present_stages > best.score) {
      best = { id: String(row.id), score: coverage.present_stages }
    }
  }
  return best?.id ?? null
}
