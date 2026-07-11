import type { ExecutiveDashboardDto, ReportClassification } from '../types/executive-demo.types'
import { STORY_STAGE_KEYS } from './story-coverage'

export function resolveNationalReportClassification(
  dashboard: ExecutiveDashboardDto,
  includeDemo: boolean,
): ReportClassification {
  if (includeDemo) return 'internal_demo'

  const hasLegacy = dashboard.data_audit.some((a) => a.status === 'legacy_only')
  const hasPilot = dashboard.data_audit.some((a) => a.status === 'pilot_only')
  const hasEmptyPipeline = dashboard.data_audit.some(
    (a) =>
      ['evidence_validations', 'verification_need_resolutions', 'response_assessments'].includes(
        a.stage,
      ) && a.count === 0,
  )
  const tenantIncidents = dashboard.metrics.find((m) => m.key === 'incidents')?.value ?? 0

  if (hasLegacy || hasPilot || hasEmptyPipeline || tenantIncidents === 0) {
    return 'draft'
  }

  return 'internal_use'
}

export function resolveIncidentReportClassification(input: {
  includeDemo: boolean
  isInternalDemo: boolean
  isLegacy: boolean
  presentStages: number
  totalStages?: number
}): ReportClassification {
  if (input.includeDemo || input.isInternalDemo) return 'internal_demo'

  const total = input.totalStages ?? STORY_STAGE_KEYS.length
  if (input.isLegacy || input.presentStages < total) return 'draft'

  return 'internal_use'
}

/** National and incident reports must never auto-classify as verified. */
export function assertNeverAutoVerified(classification: ReportClassification): ReportClassification {
  if (classification === 'verified') return 'draft'
  return classification
}
