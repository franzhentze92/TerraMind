import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'
import type { ResponseOrchestrationInput, ResponseOrchestrationOutput } from '@/modules/response-orchestration/response-orchestration.types'
import { buildAssessmentIdempotencyKey } from '@/modules/response-orchestration/response-orchestration.types'
import type { DecisionRecordDraft } from '@/modules/response-orchestration/engine/decision-workflow.engine'
import type { ResponseActionDraft } from '@/modules/response-orchestration/engine/response-action.executor'

export async function findAssessmentByIdempotency(organizationId: string, idempotencyKey: string) {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('response_assessments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return data
}

export async function getActiveAssessmentForIncident(incidentId: string, organizationId: string) {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('response_assessments')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .maybeSingle()
  return data
}

export async function listAssessmentsForOrganization(organizationId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('response_assessments')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function insertResponseAssessment(input: {
  organizationId: string
  incidentId: string
  incidentVersion: number
  verificationResolutionId?: string | null
  orchestrationInput: ResponseOrchestrationInput
  output: ResponseOrchestrationOutput
  idempotencyKey: string
  supersedesAssessmentId?: string | null
}) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('response_assessments')
    .insert({
      organization_id: input.organizationId,
      incident_id: input.incidentId,
      incident_version: input.incidentVersion,
      verification_resolution_id: input.verificationResolutionId ?? null,
      recommended_response_level: input.output.recommendedResponseLevel,
      urgency: input.output.urgency,
      rationale_codes: input.output.rationaleCodes,
      blocking_uncertainties: input.output.blockingUncertainties,
      recommended_actions: input.output.recommendedActions,
      prohibited_actions: input.output.prohibitedActions,
      required_authority: input.output.requiredAuthority,
      closure_recommendation: input.output.closureRecommendation,
      reassessment_at: input.output.reassessmentAt ?? null,
      input_snapshot: input.orchestrationInput,
      input_signature: input.output.inputSignature,
      output_signature: input.output.outputSignature,
      status: input.output.assessmentStatus,
      idempotency_key: input.idempotencyKey,
      supersedes_assessment_id: input.supersedesAssessmentId ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export function buildResponseAssessmentIdempotencyKey(input: ResponseOrchestrationInput): string {
  return buildAssessmentIdempotencyKey({
    organizationId: input.organizationId,
    incidentId: input.incident.incident_id,
    incidentVersion: input.incident.incident_version,
    resolutionSignature: input.verificationResolution.version_signature,
    reevaluationSignature: JSON.stringify(input.reevaluationState.snapshot_versions),
    modelVersion: '1.0.0',
  })
}

export async function insertDecisionRecord(input: {
  organizationId: string
  incidentId: string
  assessmentId: string
  draft: DecisionRecordDraft
  decidedBy?: string | null
  supersedesDecisionId?: string | null
}) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('decision_records')
    .insert({
      organization_id: input.organizationId,
      incident_id: input.incidentId,
      response_assessment_id: input.assessmentId,
      decision: input.draft.decision,
      decision_type: input.draft.decision_type,
      decision_status: input.draft.decision_status,
      original_recommendation: input.draft.original_recommendation,
      decided_by: input.decidedBy ?? null,
      rationale: input.draft.rationale,
      limitations: input.draft.limitations,
      decided_at: input.draft.decision_status === 'approved' ? new Date().toISOString() : null,
      supersedes_decision_id: input.supersedesDecisionId ?? null,
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function getDecisionById(decisionId: string) {
  const admin = getSupabaseAdmin()
  const { data } = await admin.from('decision_records').select('*').eq('id', decisionId).maybeSingle()
  return data
}

export async function getActiveDecisionForIncident(incidentId: string, organizationId: string) {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('decision_records')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .not('decision_status', 'in', '("superseded","cancelled")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function updateDecisionRecord(
  decisionId: string,
  patch: Record<string, unknown>,
  expectedUpdatedAt?: string,
) {
  const admin = getSupabaseAdmin()
  let query = admin.from('decision_records').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', decisionId)
  if (expectedUpdatedAt) query = query.eq('updated_at', expectedUpdatedAt)
  const { data, error } = await query.select('*').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data && expectedUpdatedAt) throw new Error('decision_concurrency_conflict')
  return data
}

export async function insertResponseActions(input: {
  organizationId: string
  incidentId: string
  decisionId: string
  drafts: ResponseActionDraft[]
}) {
  if (input.drafts.length === 0) return []
  const admin = getSupabaseAdmin()
  const rows = input.drafts.map((d) => ({
    organization_id: input.organizationId,
    incident_id: input.incidentId,
    decision_id: input.decisionId,
    action_type: d.action_type,
    status: d.status,
    owner_type: d.owner_type,
    owner_id: d.owner_id,
    priority: d.priority,
    execution_mode: d.execution_mode,
    requires_approval: d.requires_approval,
    rationale_code: d.rationale_code,
  }))
  const { data, error } = await admin.from('response_actions').insert(rows).select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function getActionById(actionId: string) {
  const admin = getSupabaseAdmin()
  const { data } = await admin.from('response_actions').select('*').eq('id', actionId).maybeSingle()
  return data
}

export async function listActionsForDecision(decisionId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('response_actions')
    .select('*')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function updateResponseAction(actionId: string, patch: Record<string, unknown>) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('response_actions')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', actionId)
    .select('*')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function insertNotificationDirectives(input: {
  organizationId: string
  incidentId: string
  decisionId: string
  directives: Array<{
    audience_type: string
    channel_type: string
    urgency: string
    message_template_id: string
    approval_required: boolean
    draft_payload: Record<string, unknown>
  }>
}) {
  if (input.directives.length === 0) return []
  const admin = getSupabaseAdmin()
  const rows = input.directives.map((d) => ({
    organization_id: input.organizationId,
    incident_id: input.incidentId,
    decision_id: input.decisionId,
    ...d,
    status: 'draft',
  }))
  const { data, error } = await admin.from('notification_directives').insert(rows).select('*')
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function listNotificationDirectivesForDecision(decisionId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('notification_directives')
    .select('*')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function recordResponseOrchestrationEvent(input: {
  organizationId: string
  incidentId: string
  assessmentId?: string | null
  decisionId?: string | null
  eventType: string
  actorType?: 'system' | 'user'
  actorId?: string | null
  payload?: Record<string, unknown>
}) {
  const admin = getSupabaseAdmin()
  await admin.from('response_orchestration_events').insert({
    organization_id: input.organizationId,
    incident_id: input.incidentId,
    assessment_id: input.assessmentId ?? null,
    decision_id: input.decisionId ?? null,
    event_type: input.eventType,
    actor_type: input.actorType ?? 'system',
    actor_id: input.actorId ?? null,
    payload: input.payload ?? {},
  })
}

export async function listResponseOrchestrationHistory(incidentId: string, organizationId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('response_orchestration_events')
    .select('*')
    .eq('incident_id', incidentId)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function enqueueResponseAssessmentJob(input: {
  organizationId: string
  incidentId: string
  verificationResolutionId?: string | null
  dependencies: string[]
  idempotencyKey: string
}) {
  const admin = getSupabaseAdmin()
  const status = input.dependencies.length > 0 ? 'waiting_dependencies' : 'ready'
  const { error } = await admin.from('response_assessment_jobs').insert({
    organization_id: input.organizationId,
    incident_id: input.incidentId,
    verification_resolution_id: input.verificationResolutionId ?? null,
    status,
    dependencies: input.dependencies,
    idempotency_key: input.idempotencyKey,
  })
  if (error) {
    if (error.code === '23505') return { duplicate: true }
    throw new Error(error.message)
  }
  return { duplicate: false }
}

export async function claimResponseAssessmentJob(workerId: string) {
  const admin = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data: candidates, error } = await admin
    .from('response_assessment_jobs')
    .select('*')
    .in('status', ['ready', 'waiting_dependencies', 'failed_retryable'])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(1)
  if (error) throw new Error(error.message)
  const job = candidates?.[0]
  if (!job) return null

  const { data: claimed, error: claimError } = await admin
    .from('response_assessment_jobs')
    .update({
      status: 'running',
      locked_at: now,
      locked_by: workerId,
      attempts: Number(job.attempts ?? 0) + 1,
      updated_at: now,
    })
    .eq('id', job.id)
    .in('status', ['ready', 'waiting_dependencies', 'failed_retryable'])
    .select('*')
    .maybeSingle()
  if (claimError) throw new Error(claimError.message)
  return claimed
}

export async function updateResponseAssessmentJob(jobId: string, patch: Record<string, unknown>) {
  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('response_assessment_jobs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) throw new Error(error.message)
}

export async function findResponseAssessmentJobByIdempotency(organizationId: string, idempotencyKey: string) {
  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from('response_assessment_jobs')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()
  return data
}

export async function releaseStaleResponseAssessmentJobLocks(lockTimeoutMinutes: number): Promise<number> {
  const admin = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - lockTimeoutMinutes * 60_000).toISOString()
  const { data, error } = await admin
    .from('response_assessment_jobs')
    .update({
      status: 'ready',
      locked_at: null,
      locked_by: null,
      updated_at: new Date().toISOString(),
    })
    .eq('status', 'running')
    .lt('locked_at', cutoff)
    .select('id')
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function countResponseAssessmentJobsByStatus(): Promise<Record<string, number>> {
  const admin = getSupabaseAdmin()
  const statuses = [
    'pending',
    'waiting_dependencies',
    'ready',
    'running',
    'completed',
    'blocked_inconsistent_snapshot',
    'failed_retryable',
    'failed_terminal',
  ]
  const counts: Record<string, number> = {}
  for (const status of statuses) {
    const { count, error } = await admin
      .from('response_assessment_jobs')
      .select('id', { head: true, count: 'exact' })
      .eq('status', status)
    if (error) throw new Error(error.message)
    counts[status] = count ?? 0
  }
  return counts
}

export async function countLegacyIncidentAssessments(): Promise<number> {
  const admin = getSupabaseAdmin()
  const { data: legacyIncidents, error: incError } = await admin
    .from('incidents')
    .select('id')
    .is('organization_id', null)
  if (incError) throw new Error(incError.message)
  const ids = (legacyIncidents ?? []).map((r) => r.id as string)
  if (ids.length === 0) return 0

  const { count, error } = await admin
    .from('response_assessments')
    .select('id', { head: true, count: 'exact' })
    .in('incident_id', ids)
  if (error) throw new Error(error.message)
  return count ?? 0
}
