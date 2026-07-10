import { ALL_VALIDATION_PERMISSIONS } from '@/modules/evidence/config/fire-evidence-validation.config'
import { assertValidationPermission } from '@/modules/evidence/validation/evidence-validation-permissions'
import { runEvidenceValidation } from '@/pipeline/engines/evidence/evidence-validation.runner'
import { enqueueEvidenceValidationJob } from '@/pipeline/stores/evidence-validation-jobs.store'
import {
  getActiveValidation,
  getValidationChecks,
  listMissionConflictFlags,
  listMissionValidations,
  listValidationHistory,
} from '@/pipeline/stores/evidence-validation.store'
import { getEvidenceSubmissionById } from '@/pipeline/stores/evidence-intake.store'

function defaultPermissions() {
  return ALL_VALIDATION_PERMISSIONS
}

export async function getSubmissionValidation(submissionId: string) {
  const validation = await getActiveValidation(submissionId)
  if (!validation) return null
  const checks = await getValidationChecks(validation.id as string)
  return { validation, checks }
}

export async function getSubmissionValidationHistory(submissionId: string) {
  const history = await listValidationHistory(submissionId)
  return { items: history, generated_at: new Date().toISOString() }
}

export async function getMissionEvidenceValidations(missionId: string) {
  const items = await listMissionValidations(missionId)
  return { items, generated_at: new Date().toISOString() }
}

export async function getMissionEvidenceQualitySummary(missionId: string) {
  const validations = await listMissionValidations(missionId)
  const conflicts = await listMissionConflictFlags(missionId)

  const counts = {
    accepted: 0,
    accepted_with_limitations: 0,
    inconclusive: 0,
    rejected: 0,
    withdrawn: 0,
    superseded: 0,
    pending: 0,
  }
  for (const v of validations) {
    const s = String(v.status)
    if (s in counts) counts[s as keyof typeof counts] += 1
  }

  return {
    mission_id: missionId,
    validation_counts: counts,
    total_validations: validations.length,
    conflict_flags: conflicts.length,
    conflicts,
    generated_at: new Date().toISOString(),
  }
}

export async function revalidateEvidenceSubmission(
  submissionId: string,
  input: { actor_id?: string | null; idempotency_key?: string | null },
) {
  assertValidationPermission(defaultPermissions(), 'revalidate')

  const submission = await getEvidenceSubmissionById(submissionId)
  if (!submission) throw new Error('Submission no encontrada')
  if (submission.status !== 'ready_for_validation') {
    throw new Error('Solo submissions listas para validación pueden revalidarse')
  }

  const result = await runEvidenceValidation(submissionId, {
    idempotencyKey: input.idempotency_key,
    force: true,
  })
  return { ok: true, ...result }
}

export async function enqueueSubmissionValidation(submissionId: string) {
  return enqueueEvidenceValidationJob({ submissionId })
}
