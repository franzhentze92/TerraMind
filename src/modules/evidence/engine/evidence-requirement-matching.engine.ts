import { METADATA_REQUIREMENTS_BY_TYPE } from '@/modules/evidence/config/fire-evidence-intake.config'
import type {
  EvidenceRequirementLinkResult,
  EvidenceRequirementSnapshot,
  RequirementMatchType,
} from '@/modules/evidence/evidence-intake.types'

function scoreTypeMatch(
  submissionType: string,
  requirementType: string,
): { score: number; match_type: RequirementMatchType; reason: string } {
  if (submissionType === requirementType) {
    return { score: 1, match_type: 'matched', reason: 'Tipo de evidencia coincide' }
  }
  const partialPairs: Record<string, string[]> = {
    georeferenced_photo: ['timestamped_photo', 'drone_image'],
    timestamped_photo: ['georeferenced_photo'],
    drone_image: ['georeferenced_photo'],
    structured_observation: ['timestamped_note'],
    timestamped_note: ['structured_observation'],
  }
  if (partialPairs[submissionType]?.includes(requirementType)) {
    return {
      score: 0.6,
      match_type: 'partial_match',
      reason: 'Tipo parcialmente compatible',
    }
  }
  return { score: 0, match_type: 'not_matched', reason: 'Tipo no compatible' }
}

export function evaluateRequirementLinks(input: {
  evidence_type: string
  requirements: EvidenceRequirementSnapshot[]
  explicit_requirement_ids?: string[]
  has_assets: boolean
  has_observation: boolean
  missing_metadata: string[]
}): EvidenceRequirementLinkResult[] {
  const targets =
    input.explicit_requirement_ids && input.explicit_requirement_ids.length > 0
      ? input.requirements.filter((r) => input.explicit_requirement_ids!.includes(r.id))
      : input.requirements

  return targets.map((req) => {
    const typeMatch = scoreTypeMatch(input.evidence_type, req.evidence_type)
    let match_type = typeMatch.match_type
    let match_score = typeMatch.score
    const reasons = [typeMatch.reason]

    if (match_type !== 'not_matched') {
      const requiredMeta = METADATA_REQUIREMENTS_BY_TYPE[req.evidence_type] ?? []
      const missingForReq = requiredMeta.filter((m) => input.missing_metadata.includes(m))
      if (missingForReq.length > 0) {
        match_type = 'partial_match'
        match_score = Math.min(match_score, 0.5)
        reasons.push(`Metadatos incompletos: ${missingForReq.join(', ')}`)
      }
      if (req.evidence_type === 'structured_observation' && !input.has_observation) {
        match_type = 'partial_match'
        match_score = Math.min(match_score, 0.4)
        reasons.push('Observación estructurada pendiente')
      }
      if (req.evidence_type !== 'structured_observation' && !input.has_assets) {
        match_type = 'partial_match'
        match_score = Math.min(match_score, 0.4)
        reasons.push('Archivo pendiente')
      }
    }

    if (match_score > 0 && match_score < 1 && match_type === 'matched') {
      match_type = 'partial_match'
    }
    if (match_score > 0 && match_type === 'not_matched') {
      match_type = 'potential_match'
      match_score = 0.3
    }

    return {
      requirement_id: req.id,
      match_type,
      match_score,
      match_reason: reasons.join('; '),
      preliminary_coverage: match_type,
    }
  })
}

export function computeEvidenceCoverage(input: {
  mission_id: string
  requirements: EvidenceRequirementSnapshot[]
  submissions: Array<{
    id: string
    status: string
    evidence_type: string
    linked_requirement_ids: string[]
  }>
  now_iso: string
}): import('@/modules/evidence/evidence-intake.types').EvidenceCoverageSnapshot {
  const unlinked = input.submissions
    .filter((s) => s.linked_requirement_ids.length === 0 && s.status !== 'withdrawn')
    .map((s) => s.id)

  const requirements = input.requirements.map((req) => {
    const linked = input.submissions.filter((s) =>
      s.linked_requirement_ids.includes(req.id),
    )
    const active = linked.filter((s) => !['withdrawn', 'duplicate', 'unsupported'].includes(s.status))
    const ready = active.filter((s) => s.status === 'ready_for_validation')

    let preliminary_status: 'none' | 'received' | 'partial' | 'ready_for_validation' | 'unlinked' =
      'none'
    if (active.length > 0) preliminary_status = 'received'
    if (active.length > 0 && active.length < req.minimum_count) preliminary_status = 'partial'
    if (ready.length >= req.minimum_count) preliminary_status = 'ready_for_validation'

    return {
      requirement_id: req.id,
      evidence_type: req.evidence_type,
      required: req.required,
      minimum_count: req.minimum_count,
      submission_count: active.length,
      preliminary_status,
      linked_submission_ids: active.map((s) => s.id),
    }
  })

  return {
    mission_id: input.mission_id,
    requirements,
    unlinked_submission_ids: unlinked,
    generated_at: input.now_iso,
  }
}
