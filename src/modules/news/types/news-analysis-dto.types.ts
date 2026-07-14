import type { NewsAnalysisStatus } from '@/pipeline/stores/news-analysis.store'

export interface NewsEvidenceDto {
  field: string
  field_label: string
  excerpt: string
  position_hint: string | null
}

export interface NewsFactDto {
  fact_type: string
  statement: string
  confidence: number
  epistemic_status?: string
  epistemic_status_label?: string
  evidence: NewsEvidenceDto[]
}

export interface NewsCorroborationDto {
  source_name: string
  coverage_label: string
  level: string
  level_label: string
  factual_status_label: string
}

export interface NewsSensitivityDto {
  code: string
  label: string
  reason: string | null
  consequence: string | null
}

export interface NewsAnalysisVersionDto {
  id: string
  analysis_version: string
  prompt_version: string
  status: string
  status_label: string
  is_active: boolean
  created_at: string
}

export interface NewsClaimDto {
  id: string
  claim_type: string
  claim_type_label: string
  statement: string
  epistemic_status: string
  epistemic_status_label: string
  confidence: number
  evidence: NewsEvidenceDto[]
  validation_status: string
  validation_status_label: string
}

export interface NewsEntityDto {
  id: string
  mentioned_name: string
  normalized_name: string
  entity_type: string
  entity_type_label: string
  /** Grupo de presentación: participants | facts | location | source | other */
  entity_group: string
  role_in_document: string | null
  confidence: number
  status: string
  status_label: string
  evidence: NewsEvidenceDto[]
}

export interface NewsRelationshipDto {
  subject_entity_id: string
  predicate: string
  object_entity_id: string
  confidence: number
  epistemic_status: string
  epistemic_status_label: string
  evidence: NewsEvidenceDto[]
}

export interface NewsAnalysisLocationDto {
  id: string
  name: string
  role: string
  role_label: string
  department_code: string | null
  confidence: number
  evidence: NewsEvidenceDto[]
}

export interface NewsTemporalReferenceDto {
  id: string
  role: string
  role_label: string
  iso_date: string | null
  iso_date_time: string | null
  text_reference: string
  precision: string
  confidence: number
  evidence: NewsEvidenceDto[]
}

export interface NewsUnknownDto {
  category: string
  description: string
}

export interface NewsEventCandidateDto {
  qualifies: boolean
  candidate_type: string | null
  candidate_title: string | null
  confidence: number
  reason: string
  promotion_recommendation: string
  promotion_recommendation_label: string
  root_event_candidate: string | null
  document_role: string | null
  document_role_label: string | null
  development_type: string | null
}

export interface NewsRejectedRelationDto {
  subject: string
  predicate: string
  object: string
  reason: string
}

export interface NewsMetricDto {
  id: string | null
  metric_type: string
  label: string
  value: number
  value_label: string
  unit: string | null
  qualifier: string | null
  status: string | null
  /** Grupo de presentación: human | housing | infrastructure | emergency_type | other */
  group: string
  group_label: string
  source_name: string | null
  geographic_scope: string | null
  cutoff_date: string | null
  cutoff_date_label: string | null
  period_start: string | null
  period_end: string | null
  confidence: number
  epistemic_status: string | null
  epistemic_status_label: string | null
  evidence: NewsEvidenceDto[]
  /** Indicador destacado para tarjeta numérica. */
  highlighted: boolean
}

export interface NewsSectorRelevanceDto {
  sector: string
  relevance: string | null
  reasons: string[]
  supporting_metrics: string[]
  confidence: number
}

export interface NewsThreatHintDto {
  qualifies_for_future_evaluation: boolean
  proposed_title: string | null
  reasons: string[]
  missing_requirements: string[]
  confidence: number
}

export interface NewsClassificationDto {
  original_category: string | null
  primary_category: string | null
  secondary_categories: string[]
}

export interface NewsReportingPeriodDto {
  cutoff_date: string | null
  cutoff_date_label: string | null
  period_start: string | null
  period_end: string | null
  cumulative: boolean | null
  status: string | null
  text_reference: string | null
}

export interface NewsDocumentCoverageDto {
  level: 'sufficient' | 'partial' | 'insufficient'
  label: string
  reason: string
}

export interface NewsRecommendedPrimarySourceDto {
  source_type: string
  reason: string
  fields_it_would_complete: string[]
}

export interface NewsDocumentAnalysisDto {
  id: string
  document_id: string
  document_title: string | null
  status: NewsAnalysisStatus
  status_label: string
  analysis_version: string
  model_provider: string | null
  model_name: string | null
  prompt_version: string
  analytical_summary: string | null
  /** Confianza de extracción (0–1), nunca 100 %. */
  extraction_confidence: number | null
  relevance_score: number | null
  analysis_confidence: number | null
  corroboration: NewsCorroborationDto
  primary_fact: NewsFactDto | null
  related_facts: NewsFactDto[]
  claims: NewsClaimDto[]
  entities: NewsEntityDto[]
  relationships: NewsRelationshipDto[]
  locations: NewsAnalysisLocationDto[]
  temporal_references: NewsTemporalReferenceDto[]
  publication_date: string | null
  event_date_label: string
  uncertainties: Array<{ statement: string; reason: string }>
  unknowns: NewsUnknownDto[]
  event_candidate: NewsEventCandidateDto | null
  sensitivity_flags: NewsSensitivityDto[]
  metrics: NewsMetricDto[]
  sector_relevance: NewsSectorRelevanceDto[]
  threat_hint: NewsThreatHintDto | null
  classification: NewsClassificationDto | null
  reporting_period: NewsReportingPeriodDto | null
  document_coverage: NewsDocumentCoverageDto | null
  recommended_primary_source: NewsRecommendedPrimarySourceDto | null
  requires_human_review: boolean
  review_reasons: string[]
  review_status: string
  review_status_label: string
  version_history: NewsAnalysisVersionDto[]
  validation_summary: {
    valid: boolean
    warning_count: number
    error_count: number
    rejected_claim_count: number
    adjusted_claim_count: number
    rejected_relation_count: number
    warnings: string[]
    technical_codes: string[]
    rejected_relations: NewsRejectedRelationDto[]
  }
  created_at: string
  updated_at: string
}

export interface NewsAnalysisBatchDryRunDto {
  eligible_documents: Array<{ id: string; title: string }>
  already_analyzed: Array<{ id: string; title: string; analysis_id: string }>
  skipped_not_ready: Array<{ id: string; title: string; reason: string }>
  estimated_input_tokens: number
  estimated_output_tokens: number
  estimated_cost_usd: number
  model_tier: string
  model_name: string
  warnings: string[]
}

export interface NewsAnalysisBatchResultDto {
  dry_run: boolean
  processed: number
  failed: number
  results: Array<{
    document_id: string
    analysis_id: string | null
    status: string
    error?: string
  }>
  total_estimated_cost_usd?: number
  total_actual_cost_usd?: number
}

export interface NewsAnalysisReviewQueueItemDto {
  id: string
  document_id: string
  document_title: string | null
  status: string
  status_label: string
  relevance_score: number | null
  requires_human_review: boolean
  review_reasons: string[]
  sensitivity_flags: NewsSensitivityDto[]
  primary_fact_statement: string | null
  created_at: string
}
