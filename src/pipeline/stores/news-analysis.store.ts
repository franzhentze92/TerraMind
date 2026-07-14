/**
 * Store de análisis documental — Bloque N2.
 */
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'
import type { AiAnalysisOutput } from '@/modules/news/schemas/ai-analysis.schema'
import type { AnalysisValidationResult } from '@/modules/news/engines/analysis-evidence-validator'

export type NewsAnalysisStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'completed_with_warnings'
  | 'failed'
  | 'needs_review'
  | 'rejected'

export type NewsAnalysisReviewStatus = 'pending' | 'approved' | 'rejected' | 'corrected'

export interface NewsDocumentAnalysisRow {
  id: string
  document_id: string
  analysis_version: string
  model_provider: string | null
  model_name: string | null
  prompt_version: string
  input_hash: string
  status: NewsAnalysisStatus
  relevance_score: number | null
  analysis_confidence: number | null
  analytical_summary: string | null
  primary_fact: unknown
  related_facts: unknown
  entities: unknown
  relationships: unknown
  locations: unknown
  temporal_references: unknown
  uncertainties: unknown
  unknowns: unknown
  event_candidate: unknown
  sensitivity_flags: unknown
  metrics: unknown
  sector_relevance: unknown
  threat_hint: unknown
  classification: unknown
  reporting_period: unknown
  document_coverage: unknown
  recommended_primary_source: unknown
  review_status: NewsAnalysisReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  raw_model_response: unknown
  validation_result: unknown
  token_usage: unknown
  estimated_cost_usd: number | null
  requires_human_review: boolean
  review_reasons: unknown
  created_at: string
  updated_at: string
}

export interface NewsClaimRow {
  id: string
  analysis_id: string
  claim_type: string
  statement: string
  epistemic_status: string
  confidence: number
  evidence_references: unknown
  subject_entity_ids: unknown
  object_entity_ids: unknown
  location_ids: unknown
  temporal_reference_ids: unknown
  quantity: number | null
  unit: string | null
  sensitivity: string | null
  validation_status: string
  validation_notes: unknown
  created_at: string
}

export async function getLatestAnalysisForDocument(
  documentId: string,
): Promise<NewsDocumentAnalysisRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('news_document_analyses')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as NewsDocumentAnalysisRow | null
}

export async function getAnalysisById(id: string): Promise<NewsDocumentAnalysisRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('news_document_analyses')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as NewsDocumentAnalysisRow | null
}

export async function listClaimsForAnalysis(analysisId: string): Promise<NewsClaimRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('news_claims')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as NewsClaimRow[]
}

export async function createAnalysisQueued(input: {
  documentId: string
  analysisVersion: string
  promptVersion: string
  inputHash: string
}): Promise<NewsDocumentAnalysisRow> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('news_document_analyses')
    .insert({
      document_id: input.documentId,
      analysis_version: input.analysisVersion,
      prompt_version: input.promptVersion,
      input_hash: input.inputHash,
      status: 'queued',
    })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as NewsDocumentAnalysisRow
}

export async function updateAnalysis(
  id: string,
  patch: Partial<NewsDocumentAnalysisRow>,
): Promise<NewsDocumentAnalysisRow> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('news_document_analyses')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as NewsDocumentAnalysisRow
}

export async function insertClaims(
  analysisId: string,
  claims: Array<{
    claimType: string
    statement: string
    epistemicStatus: string
    confidence: number
    evidenceReferences: unknown[]
    subjectEntityIds: string[]
    objectEntityIds: string[]
    locationIds: string[]
    temporalReferenceIds: string[]
    quantity: number | null
    unit: string | null
    sensitivity: string | null
    validationStatus: string
    validationNotes: unknown[]
  }>,
): Promise<void> {
  if (claims.length === 0) return
  const supabase = getSupabaseAdmin()
  const rows = claims.map((c) => ({
    analysis_id: analysisId,
    claim_type: c.claimType,
    statement: c.statement,
    epistemic_status: c.epistemicStatus,
    confidence: c.confidence,
    evidence_references: c.evidenceReferences,
    subject_entity_ids: c.subjectEntityIds,
    object_entity_ids: c.objectEntityIds,
    location_ids: c.locationIds,
    temporal_reference_ids: c.temporalReferenceIds,
    quantity: c.quantity,
    unit: c.unit,
    sensitivity: c.sensitivity,
    validation_status: c.validationStatus,
    validation_notes: c.validationNotes,
  }))
  const { error } = await supabase.from('news_claims').insert(rows)
  if (error) throw new Error(error.message)
}

export async function listAnalysisVersionsForDocument(
  documentId: string,
): Promise<NewsDocumentAnalysisRow[]> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('news_document_analyses')
    .select('*')
    .eq('document_id', documentId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as NewsDocumentAnalysisRow[]
}

export async function listAnalyses(filters: {
  status?: string
  requiresReview?: boolean
  limit?: number
}): Promise<NewsDocumentAnalysisRow[]> {
  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('news_document_analyses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 50)

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.requiresReview === true) query = query.eq('requires_human_review', true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as NewsDocumentAnalysisRow[]
}

export function persistableFromValidatedOutput(
  output: AiAnalysisOutput,
  validation: AnalysisValidationResult,
): {
  primaryFact: unknown
  relatedFacts: unknown
  entities: unknown
  relationships: unknown
  locations: unknown
  temporalReferences: unknown
  uncertainties: unknown
  unknowns: unknown
  eventCandidate: unknown
  sensitivityFlags: unknown
  metrics: unknown
  sectorRelevance: unknown
  threatHint: unknown
  classification: unknown
  reportingPeriod: unknown
  documentCoverage: unknown
  recommendedPrimarySource: unknown
  relevanceScore: number
  analysisConfidence: number
  analyticalSummary: string | null
  requiresHumanReview: boolean
  reviewReasons: string[]
} {
  const claims = validation.acceptedOutput.claims
  const avgClaimConfidence =
    claims.length > 0
      ? claims.reduce((s, c) => s + c.confidence, 0) / claims.length
      : validation.acceptedOutput.primaryFact?.confidence ?? output.documentRelevance.score
  const cappedConfidence = Math.min(avgClaimConfidence, 0.97)

  return {
    primaryFact: validation.acceptedOutput.primaryFact,
    relatedFacts: validation.acceptedOutput.relatedFacts,
    entities: validation.acceptedOutput.entities,
    relationships: validation.acceptedOutput.relationships,
    locations: validation.acceptedOutput.locations,
    temporalReferences: validation.acceptedOutput.temporalReferences,
    uncertainties: validation.acceptedOutput.uncertainties,
    unknowns: validation.acceptedOutput.unknowns,
    eventCandidate: validation.acceptedOutput.eventCandidate,
    sensitivityFlags: validation.acceptedOutput.sensitivityFlags,
    metrics: validation.acceptedOutput.metrics ?? [],
    sectorRelevance: validation.acceptedOutput.sectorRelevance ?? [],
    threatHint: validation.acceptedOutput.threatHint ?? null,
    classification: validation.acceptedOutput.classification ?? null,
    reportingPeriod: validation.acceptedOutput.reportingPeriod ?? null,
    documentCoverage: validation.acceptedOutput.documentCoverage ?? null,
    recommendedPrimarySource: validation.acceptedOutput.recommendedPrimarySource ?? null,
    relevanceScore: validation.acceptedOutput.documentRelevance.score,
    analysisConfidence: cappedConfidence,
    analyticalSummary: validation.acceptedOutput.analyticalSummary ?? null,
    requiresHumanReview: validation.requiresReview,
    reviewReasons: [
      ...validation.acceptedOutput.reviewReasons,
      ...validation.warnings.map((w) => w.message),
    ],
  }
}
