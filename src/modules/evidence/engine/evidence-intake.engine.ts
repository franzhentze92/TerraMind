import { assertSafeEvidenceCopy } from '@/modules/evidence/evidence-intake-copy-guard'
import type {
  EvidenceIntakeEvaluationResult,
  EvidenceSubmissionInput,
  EvidenceSubmissionStatus,
} from '@/modules/evidence/evidence-intake.types'
import { assertEvidencePermission } from '@/modules/evidence/evidence-permissions'
import {
  ALLOWED_MIME_TYPES,
  EVIDENCE_INTAKE_PROFILE_VERSION,
  MAX_ASSETS_PER_SUBMISSION,
} from '@/modules/evidence/config/fire-evidence-intake.config'
import { EVIDENCE_TYPES } from '@/modules/evidence/evidence-intake.types'

const BLOCKED_MISSION_STATUSES = ['cancelled', 'expired']

export function evaluateCreateSubmission(input: {
  command: EvidenceSubmissionInput
  mission_status: string
  mission_cancelled: boolean
}): EvidenceIntakeEvaluationResult {
  try {
    assertEvidencePermission(input.command.actor.permissions, 'create_submission')
  } catch (err) {
    return fail('create_submission', err)
  }

  if (BLOCKED_MISSION_STATUSES.includes(input.mission_status) || input.mission_cancelled) {
    return fail('create_submission', new Error('Misión no acepta evidencia en este estado'))
  }

  if (!EVIDENCE_TYPES.includes(input.command.evidence_type)) {
    return fail('create_submission', new Error(`Tipo de evidencia no soportado: ${input.command.evidence_type}`))
  }

  try {
    if (input.command.description) assertSafeEvidenceCopy(input.command.description)
  } catch (err) {
    return fail('create_submission', err)
  }

  return {
    ok: true,
    action: 'create_submission',
    submission_id: null,
    submission_status: 'received',
    reasons: ['Submission creada; pendiente de contenido'],
    warnings: [],
    idempotent_replay: false,
  }
}

export function evaluateWithdrawSubmission(input: {
  submission_status: EvidenceSubmissionStatus
  submitted_by_id: string
  actor_id: string | null
  permissions: EvidenceSubmissionInput['actor']['permissions']
  reason?: string
  idempotency_key?: string | null
  existing_idempotency_key?: string | null
}): EvidenceIntakeEvaluationResult {
  if (
    input.idempotency_key &&
    input.existing_idempotency_key === input.idempotency_key
  ) {
    return {
      ok: true,
      action: 'withdraw',
      submission_id: null,
      submission_status: 'withdrawn',
      reasons: ['Operación idempotente ya aplicada'],
      warnings: [],
      idempotent_replay: true,
    }
  }

  try {
    assertEvidencePermission(input.permissions, 'withdraw')
  } catch (err) {
    return fail('withdraw', err)
  }

  if (input.submission_status === 'withdrawn') {
    return fail('withdraw', new Error('Submission ya retirada'))
  }
  if (['ready_for_validation', 'duplicate'].includes(input.submission_status)) {
    return fail('withdraw', new Error('No se puede retirar evidencia en este estado'))
  }
  if (input.actor_id && input.actor_id !== input.submitted_by_id) {
    return fail('withdraw', new Error('Solo el submitter puede retirar'))
  }
  if (!input.reason) return fail('withdraw', new Error('Motivo de retiro requerido'))

  return {
    ok: true,
    action: 'withdraw',
    submission_id: null,
    submission_status: 'withdrawn',
    reasons: ['Submission retirada; auditoría conservada'],
    warnings: [],
    idempotent_replay: false,
  }
}

export function evaluateConfirmUpload(input: {
  evidence_type: string
  asset_count: number
  mime_type: string
  permissions: EvidenceSubmissionInput['actor']['permissions']
  idempotency_key?: string | null
  existing_asset_idempotency?: boolean
}): EvidenceIntakeEvaluationResult {
  if (input.existing_asset_idempotency && input.idempotency_key) {
    return {
      ok: true,
      action: 'confirm_upload',
      submission_id: null,
      submission_status: 'processing',
      reasons: ['Upload ya confirmado'],
      warnings: [],
      idempotent_replay: true,
    }
  }

  try {
    assertEvidencePermission(input.permissions, 'confirm_upload')
  } catch (err) {
    return fail('confirm_upload', err)
  }

  if (input.asset_count >= MAX_ASSETS_PER_SUBMISSION) {
    return fail('confirm_upload', new Error('Cantidad máxima de archivos alcanzada'))
  }

  const allowed = ALLOWED_MIME_TYPES[input.evidence_type]
  if (allowed && !allowed.includes(input.mime_type)) {
    return fail('confirm_upload', new Error(`MIME no permitido: ${input.mime_type}`))
  }

  return {
    ok: true,
    action: 'confirm_upload',
    submission_id: null,
    submission_status: 'processing',
    reasons: ['Upload confirmado; procesamiento encolado'],
    warnings: [],
    idempotent_replay: false,
  }
}

function fail(action: string, err: unknown): EvidenceIntakeEvaluationResult {
  return {
    ok: false,
    action,
    submission_id: null,
    submission_status: null,
    reasons: [err instanceof Error ? err.message : 'Operación rechazada'],
    warnings: [],
    idempotent_replay: false,
  }
}

export { EVIDENCE_INTAKE_PROFILE_VERSION }
