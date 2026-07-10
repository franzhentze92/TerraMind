import type {
  MissionEligibilityResult,
  MissionPlanNeedSnapshot,
  MissionPlanSnapshot,
} from '@/modules/missions/missions.types'

const INELIGIBLE_INCIDENT_STATUSES = new Set(['invalidated', 'merged', 'split'])

export function selectPrimaryNeed(
  needs: MissionPlanNeedSnapshot[],
): MissionPlanNeedSnapshot | null {
  if (needs.length === 0) return null
  return [...needs].sort((a, b) => {
    const p = b.priority - a.priority
    if (p !== 0) return p
    return a.need_type.localeCompare(b.need_type)
  })[0]
}

export function evaluateMissionEligibility(
  plan: MissionPlanSnapshot,
  blockedMethodIds: Set<string> = new Set(),
): MissionEligibilityResult {
  const reasons: string[] = []
  const limitations: string[] = []

  if (plan.status !== 'ready') {
    return {
      eligible: false,
      reasons: [`Plan en estado ${plan.status}; se requiere ready`],
      limitations: ['Solo planes listos generan misión automática'],
      primary_need: null,
      recommended_method_code: null,
    }
  }

  if (!plan.mission_candidate_pending) {
    return {
      eligible: false,
      reasons: ['Plan sin candidato de misión pendiente'],
      limitations: [],
      primary_need: null,
      recommended_method_code: null,
    }
  }

  const incidentStatus = plan.incident_snapshot.incident_status
  if (incidentStatus && INELIGIBLE_INCIDENT_STATUSES.has(incidentStatus)) {
    return {
      eligible: false,
      reasons: [`Incidente en estado ${incidentStatus}`],
      limitations: [],
      primary_need: null,
      recommended_method_code: null,
    }
  }

  const unsatisfiedNeeds = plan.needs.filter((n) => n.recommended_method_id)
  if (unsatisfiedNeeds.length === 0) {
    return {
      eligible: false,
      reasons: ['Sin necesidades con método recomendado disponible'],
      limitations: [],
      primary_need: null,
      recommended_method_code: null,
    }
  }

  const primaryNeed = selectPrimaryNeed(unsatisfiedNeeds)
  if (!primaryNeed?.recommended_method_id) {
    return {
      eligible: false,
      reasons: ['Necesidad principal sin método recomendado'],
      limitations: [],
      primary_need: null,
      recommended_method_code: null,
    }
  }

  if (primaryNeed.is_blocked || blockedMethodIds.has(primaryNeed.recommended_method_id)) {
    return {
      eligible: false,
      reasons: ['Método recomendado bloqueado o no disponible'],
      limitations: ['Plan bloqueado para creación automática de misión'],
      primary_need: primaryNeed,
      recommended_method_code: primaryNeed.recommended_method_id,
    }
  }

  reasons.push('Plan listo con necesidad y método recomendado disponible')
  reasons.push(`Necesidad principal: ${primaryNeed.need_type}`)

  return {
    eligible: true,
    reasons,
    limitations: ['La misión representa trabajo pendiente; no implica asignación'],
    primary_need: primaryNeed,
    recommended_method_code: primaryNeed.recommended_method_id,
  }
}
