export type EpistemicKind =
  | 'observed'
  | 'inferred'
  | 'verified'
  | 'undetermined'
  | 'recommended'
  | 'decided'
  | 'executed'

export type ReportClassification =
  | 'internal_use'
  | 'draft'
  | 'verified'
  | 'internal_demo'

export type DataStageStatus =
  | 'has_real_data'
  | 'empty'
  | 'legacy_only'
  | 'pilot_only'
  | 'not_connected'

export interface StageAuditEntry {
  stage: string
  count: number
  status: DataStageStatus
  note: string
}

export interface EmptyStateInfo {
  section: string
  title: string
  meaning: string
  why_empty: string
  fed_by: string
  last_known: string | null
  action: string | null
}

export interface ExecutiveMetric {
  key: string
  label: string
  value: number
  href?: string
  empty?: EmptyStateInfo
}

export interface ExecutiveSummaryNarrative {
  what_is_happening: string
  what_changed: string
  requires_attention: string
  in_verification: string
  terramind_recommends: string
  pending_decision: string
}

export interface NationalTimelineEntry {
  id: string
  timestamp: string
  stage: string
  stage_label: string
  status: string
  source: string
  confidence: string
  summary: string
  epistemic: EpistemicKind
  href?: string
  entity_id?: string
  is_internal_demo?: boolean
}

export interface ExecutiveDashboardDto {
  generated_at: string
  system_status: string
  last_sync_at: string | null
  sources_active: number
  include_demo: boolean
  metrics: ExecutiveMetric[]
  summary: ExecutiveSummaryNarrative
  priority_findings: Array<{
    id: string
    title: string
    severity_label: string
    department_name: string | null
    href: string
  }>
  active_incidents: Array<{
    id: string
    status: string
    attention_level: string
    event_count: number
    is_legacy: boolean
    is_internal_demo: boolean
    story_coverage: string
    href: string
    story_href: string
  }>
  recent_changes: NationalTimelineEntry[]
  pending_verifications: Array<{ id: string; incident_id: string; status: string; href: string }>
  missions_in_progress: Array<{ id: string; title: string; status: string; is_internal_demo: boolean; href: string }>
  recent_evidence: Array<{ id: string; status: string; mission_id: string; href: string }>
  recent_resolutions: Array<{ id: string; status: string; href: string }>
  response_recommendations: Array<{ incident_id: string; recommended_level: string; href: string }>
  pending_decisions: Array<{ incident_id: string; decision_status: string; href: string }>
  empty_sections: EmptyStateInfo[]
  data_audit: StageAuditEntry[]
  recommended_demo_incident_id: string | null
}

export interface StoryStageEntry {
  key: string
  title: string
  order: number
  epistemic: EpistemicKind
  status: 'present' | 'missing' | 'blocked' | 'not_applicable'
  timestamp: string | null
  source: string | null
  confidence: string | null
  summary: string
  detail: string | null
  href: string | null
  items: Array<Record<string, unknown>>
  empty_state?: EmptyStateInfo
}

export interface IncidentStoryCoverage {
  total_stages: number
  present_stages: number
  label: string
  stages: Record<string, boolean>
  present_stage_labels: string[]
  missing_stage_labels: string[]
}

export interface IncidentStoryDto {
  incident_id: string
  generated_at: string
  is_internal_demo: boolean
  is_legacy: boolean
  classification: ReportClassification
  coverage: IncidentStoryCoverage
  stages: StoryStageEntry[]
  timeline: NationalTimelineEntry[]
}

export interface ReportPeriod {
  preset: '24h' | '7d' | '30d' | 'custom'
  from: string
  to: string
}

export interface NationalReportDto {
  title: string
  classification: ReportClassification
  period: ReportPeriod
  generated_at: string
  dashboard: ExecutiveDashboardDto
  /** Canonical metrics (Product Consolidation — Phase 1). Report figures must match these. */
  canonical_metrics?: import('@/modules/executive-metrics/executive-metric.types').ExecutiveMetric[]
  sections: Array<{ id: string; title: string; content: string; items?: unknown[] }>
}

export interface IncidentReportDto {
  title: string
  classification: ReportClassification
  incident_id: string
  generated_at: string
  story: IncidentStoryDto
  sections: Array<{ id: string; title: string; content: string; items?: unknown[] }>
}
