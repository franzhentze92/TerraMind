import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'

export type InstitutionalReportType = 'national' | 'incident' | 'verification'

export type InstitutionalReportClassification = 'draft' | 'internal' | 'official' | 'demo'

export type InstitutionalReportStatus = 'generating' | 'ready' | 'failed' | 'archived'

export type ReportEpistemicState =
  | 'Observado'
  | 'Inferido'
  | 'Verificado'
  | 'Recomendado'
  | 'Decidido'
  | 'Ejecutado'

export interface ReportSection {
  id: string
  title: string
  content: string
  items?: string[]
  status?: 'available' | 'pending' | 'not_required' | 'legacy' | 'demo' | 'unavailable'
}

export interface ReportMetric {
  id: string
  label: string
  value: number
  scope: string
  timeWindow: string
  source: string
  breakdown: Array<{ label: string; value: number; classification: string }>
  limitations: string[]
}

export interface ReportMap {
  id: string
  title: string
  territoryLabel: string
  periodLabel: string
  source: string
  legend: string[]
  available: boolean
  errorMessage?: string
  /** Fallback tabular data when map cannot render */
  fallbackRows?: Array<{ label: string; detail: string }>
}

export interface ReportFinding {
  id: string
  title: string
  location: string
  category: string
  severity: string
  confidence: string
  generatedAt: string
  source: string
  status: string
  relevance: string
  incidentLink?: string
  limitations: string[]
}

export interface ReportIncident {
  id: string
  name: string
  location: string
  lifecycle: string
  priority: string
  eventCount: number
  verificationStatus: string
  nextStep: string
  classification: 'operational' | 'legacy' | 'demo'
}

export interface ReportVerificationSummary {
  activeNeeds: number
  legacyPlans: number
  missionsRecommended: number
  remoteSufficient: boolean
  summary: string
}

export interface ReportOperationsSummary {
  missionsOperational: number
  missionsDemo: number
  evidenceOperational: number
  resolutionsCount: number
  responseAssessments: number
  pendingDecisions: number
  summary: string
}

export interface ReportMethodology {
  general: string
  sources: string[]
  period: string
  geography: string
  filtering: string
  deduplication: string
  eventGrouping: string
  priorityModel: string
  classificationRules: string
  version: string
}

export interface ReportSource {
  name: string
  type: string
  coverage: string
  period: string
  lastUpdated: string
  status: string
  limitation: string
}

export interface ReportTimelineRow {
  date: string
  stage: string
  event: string
  epistemic: ReportEpistemicState
  source: string
  actor: string
  reference: string
}

export interface InstitutionalReport {
  id: string
  type: InstitutionalReportType
  title: string
  subtitle?: string
  classification: InstitutionalReportClassification
  classificationLabel: string
  status: InstitutionalReportStatus
  period: {
    from: string
    to: string
    label: string
    timezone: string
  }
  territory: {
    label: string
    scope: string
  }
  generatedAt: string
  generatedBy?: string
  organization?: string
  documentVersion: string
  incidentId?: string
  executiveSummary: ReportSection
  metrics: ReportMetric[]
  maps: ReportMap[]
  findings: ReportFinding[]
  incidents: ReportIncident[]
  legacyIncidents: ReportIncident[]
  demoIncidents: ReportIncident[]
  verification: ReportVerificationSummary
  operations: ReportOperationsSummary
  timeline: ReportTimelineRow[]
  sections: ReportSection[]
  methodology: ReportMethodology
  limitations: string[]
  sources: ReportSource[]
  watermark?: string
}

export function executiveMetricToReportMetric(m: ExecutiveMetric): ReportMetric {
  return {
    id: m.id,
    label: m.label,
    value: m.value,
    scope: m.scope,
    timeWindow: m.timeWindow.label,
    source: m.source,
    breakdown: m.breakdown.map((b) => ({
      label: b.label,
      value: b.value,
      classification: b.classification,
    })),
    limitations: m.limitations,
  }
}
