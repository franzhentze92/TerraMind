import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'
import type { ResponseOrchestrationInput, ResponseOrchestrationOutput } from '@/modules/response-orchestration/response-orchestration.types'
import { buildAssessmentIdempotencyKey } from '@/modules/response-orchestration/response-orchestration.types'

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
