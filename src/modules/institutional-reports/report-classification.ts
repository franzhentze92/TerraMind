import type { ReportClassification } from '@/modules/executive-demo/types/executive-demo.types'
import type { InstitutionalReportClassification } from './institutional-report.types'

export const CLASSIFICATION_LABELS: Record<InstitutionalReportClassification, string> = {
  draft: 'BORRADOR',
  internal: 'USO INTERNO',
  official: 'OFICIAL',
  demo: 'DEMOSTRACIÓN INTERNA',
}

export function classificationLabel(classification: InstitutionalReportClassification): string {
  return CLASSIFICATION_LABELS[classification]
}

export function classificationBanner(classification: InstitutionalReportClassification): string {
  if (classification === 'draft') return 'BORRADOR · USO INTERNO'
  if (classification === 'demo') return 'DEMOSTRACIÓN INTERNA'
  if (classification === 'official') return 'OFICIAL'
  return 'USO INTERNO'
}

/** Map legacy executive-demo classification to institutional model. */
export function fromLegacyReportClassification(
  legacy: ReportClassification,
  includeDemo: boolean,
): InstitutionalReportClassification {
  if (includeDemo || legacy === 'internal_demo') return 'demo'
  if (legacy === 'draft') return 'draft'
  if (legacy === 'verified') return 'internal'
  return 'internal'
}

export interface OfficialEligibilityInput {
  classification: InstitutionalReportClassification
  includeDemo: boolean
  hasLegacyAsOperational: boolean
  hasPeriod: boolean
  hasSources: boolean
  hasMethodology: boolean
  hasIncompleteCriticalSections: boolean
  hasAssessmentWhenRecommending: boolean
}

export function canMarkOfficial(input: OfficialEligibilityInput): boolean {
  if (input.includeDemo || input.classification === 'demo') return false
  if (input.hasLegacyAsOperational) return false
  if (!input.hasPeriod || !input.hasSources || !input.hasMethodology) return false
  if (input.hasIncompleteCriticalSections) return false
  if (!input.hasAssessmentWhenRecommending) return false
  return true
}

export function resolveInstitutionalClassification(
  legacy: ReportClassification,
  includeDemo: boolean,
  opts: Omit<OfficialEligibilityInput, 'classification' | 'includeDemo'>,
): InstitutionalReportClassification {
  const base = fromLegacyReportClassification(legacy, includeDemo)
  if (base === 'demo' || base === 'draft') return base
  if (canMarkOfficial({ classification: base, includeDemo, ...opts })) {
    return 'official'
  }
  return 'internal'
}
