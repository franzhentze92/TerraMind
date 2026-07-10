export type FindingStatus = 'active' | 'monitoring' | 'resolved' | 'superseded' | 'dismissed'

export type FindingSeverityLabel = 'informational' | 'attention' | 'elevated_attention'

export type FindingConfidenceLevel = 'high' | 'moderate' | 'low' | 'insufficient'

export type FindingDomain =
  | 'fire_events'
  | 'protected_areas'
  | 'land_cover'
  | 'population'
  | 'climate'
  | 'biodiversity'

export type FireFindingType =
  | 'thermal_activity_in_protected_area'
  | 'thermal_activity_near_protected_area'
  | 'thermal_activity_on_forest_cover'
  | 'thermal_activity_in_mixed_natural_cover'
  | 'dry_conditions_around_thermal_event'
  | 'strong_wind_during_thermal_event'
  | 'nearby_population_with_reliable_estimate'
  | 'nearby_population_with_high_uncertainty'
  | 'documented_biodiversity_near_event'
  | 'biodiversity_context_limited'
  | 'multi_context_attention'

export interface FindingEvidence {
  evidence_code: string
  domain: FindingDomain
  label: string
  value: string | number | boolean | null
  unit?: string
  source: string
  reference_date?: string | null
  quality: 'official' | 'modelled' | 'documented' | 'derived'
  context_path: string
}

export interface FindingConfidence {
  level: FindingConfidenceLevel
  reasons: string[]
}

export interface CompositeFinding {
  id?: string
  finding_type: FireFindingType | string
  entity_type: string
  entity_id: string
  title: string
  summary: string
  status: FindingStatus
  severity_label: FindingSeverityLabel
  confidence: FindingConfidence
  evidence: FindingEvidence[]
  triggered_rules: string[]
  source_domains: FindingDomain[]
  geographic_context: Record<string, unknown>
  temporal_context: Record<string, unknown>
  limitations: string[]
  recommended_actions: string[]
  generated_at: string
  context_version: string
  rule_set_version: string
}

export type FindingRuleStatus = 'triggered' | 'not_triggered' | 'not_evaluable'

export interface FindingRuleResult {
  rule_code: string
  rule_version: string
  finding_type: FireFindingType | string
  status: FindingRuleStatus
  title: string
  summary: string
  severity_label: FindingSeverityLabel
  confidence: FindingConfidence
  evidence: FindingEvidence[]
  limitations: string[]
  recommended_actions: string[]
  source_domains: FindingDomain[]
}

export interface FindingEvaluationResult {
  entity_type: string
  entity_id: string
  context_version: string
  rule_set_version: string
  contexts_available: Record<string, string>
  rule_results: FindingRuleResult[]
  findings: CompositeFinding[]
  findings_created: number
  findings_updated: number
  findings_resolved: number
  warnings: string[]
  duration_ms: number
}
