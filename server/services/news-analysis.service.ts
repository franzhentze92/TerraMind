/**
 * Servicio de análisis documental — Bloque N2.
 */
import type { RequestAuthContext } from '@/core/auth/permissions.js'
import {
  buildPermittedDocumentContent,
  hashPermittedContent,
  sanitizeDocumentInputForLlm,
} from '@/modules/news/engines/build-permitted-content.js'
import { validateAnalysisOutput, estimateAnalysisCost, normalizeMetricType } from '@/modules/news/engines/analysis-evidence-validator.js'
import { shouldEscalateToDeep } from '@/modules/news/engines/escalation-policy.js'
import {
  ANALYSIS_PROMPT_VERSION,
  ANALYSIS_SCHEMA_VERSION,
} from '@/modules/news/schemas/ai-analysis.schema.js'
import { runFullExtraction, runTriageExtraction } from '@/modules/news/providers/openai-news-llm.provider.js'
import { NEWS_LLM_CONFIG, isNewsLlmEnabled, type NewsModelTier } from '@/modules/news/providers/news-llm-config.js'
import {
  analysisStatusLabel,
  claimTypeLabel,
  epistemicStatusLabel,
  evidenceFieldLabel,
  promotionRecommendationLabel,
  sensitivityFlagLabel,
  entityTypeLabel,
  entityGroup,
  documentRoleLabel,
  metricTypeLabel,
  metricGroup,
  metricGroupLabel,
  isHighlightedMetric,
  ENTITY_STATUS_LABELS,
  LOCATION_ROLE_LABELS,
  TEMPORAL_ROLE_LABELS,
  REVIEW_STATUS_LABELS,
  SENSITIVITY_DEFAULTS,
} from '@/modules/news/presentation/news-analysis-labels.js'
import type {
  NewsAnalysisBatchDryRunDto,
  NewsAnalysisBatchResultDto,
  NewsAnalysisReviewQueueItemDto,
  NewsClaimDto,
  NewsCorroborationDto,
  NewsDocumentAnalysisDto,
  NewsEvidenceDto,
  NewsFactDto,
  NewsRelationshipDto,
  NewsSensitivityDto,
} from '@/modules/news/types/news-analysis-dto.types.js'
import {
  createAnalysisQueued,
  getAnalysisById,
  getLatestAnalysisForDocument,
  insertClaims,
  listAnalyses,
  listAnalysisVersionsForDocument,
  listClaimsForAnalysis,
  persistableFromValidatedOutput,
  updateAnalysis,
} from '@/pipeline/stores/news-analysis.store.js'
import { getNewsDocumentById, listNewsDocuments } from '@/pipeline/stores/news.store.js'

function formatDateEs(iso: string | null | undefined): string | null {
  if (!iso) return null
  // Fecha sola (corte): no aplicar zona horaria UTC→local.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return null
    return new Date(y, m - 1, d).toLocaleDateString('es-GT', { dateStyle: 'medium' })
  }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Corroboración determinística: en N2 se analiza UN documento de UNA fuente.
 * Si hay atribución institucional, se distingue de la ausencia total de respaldo.
 */
function buildCorroboration(
  sourceName: string,
  attributedInstitution?: string | null,
): NewsCorroborationDto {
  if (attributedInstitution) {
    return {
      source_name: sourceName,
      coverage_label: 'Una noticia con atribución institucional',
      level: 'single_source_attributed',
      level_label: 'Una fuente periodística con atribución institucional',
      factual_status_label: `${sourceName} reporta cifras atribuidas a ${attributedInstitution}`,
    }
  }
  return {
    source_name: sourceName,
    coverage_label: 'Una noticia',
    level: 'single_source',
    level_label: 'Una fuente periodística',
    factual_status_label: `Reportado por ${sourceName} · Sin corroboración independiente`,
  }
}

function normalizeSensitivityFlags(raw: unknown): NewsSensitivityDto[] {
  if (!Array.isArray(raw)) return []
  return raw.map((flag): NewsSensitivityDto => {
    if (typeof flag === 'string') {
      const def = SENSITIVITY_DEFAULTS[flag]
      return {
        code: flag,
        label: sensitivityFlagLabel(flag),
        reason: def?.reason ?? null,
        consequence: def?.consequence ?? null,
      }
    }
    const obj = (flag ?? {}) as { code?: string; reason?: string; consequence?: string }
    const code = obj.code ?? 'sensible'
    const def = SENSITIVITY_DEFAULTS[code]
    return {
      code,
      label: sensitivityFlagLabel(code),
      reason: obj.reason ?? def?.reason ?? null,
      consequence: obj.consequence ?? def?.consequence ?? null,
    }
  })
}

function mapEvidence(evidence: Array<{ field: string; excerpt: string; positionHint?: string | null }>): NewsEvidenceDto[] {
  return evidence.map((e) => ({
    field: e.field,
    field_label: evidenceFieldLabel(e.field),
    excerpt: e.excerpt,
    position_hint: e.positionHint ?? null,
  }))
}

function mapFact(fact: {
  factType: string
  statement: string
  confidence: number
  epistemicStatus?: string
  evidence: Array<{ field: string; excerpt: string; positionHint?: string | null }>
}): NewsFactDto {
  return {
    fact_type: fact.factType,
    statement: fact.statement,
    confidence: fact.confidence,
    epistemic_status: fact.epistemicStatus,
    epistemic_status_label: fact.epistemicStatus ? epistemicStatusLabel(fact.epistemicStatus) : undefined,
    evidence: mapEvidence(fact.evidence),
  }
}

async function getSourceNameForDocument(sourceId: string): Promise<string> {
  const { getSupabaseAdmin } = await import('@/pipeline/stores/supabase.client.js')
  const supabase = getSupabaseAdmin()
  const { data } = await supabase.from('news_sources').select('name').eq('id', sourceId).maybeSingle()
  return (data as { name?: string } | null)?.name ?? 'Fuente desconocida'
}

function computeActualCostUsd(
  usage: { promptTokens: number; completionTokens: number },
  modelName: string,
): number {
  const pricing =
    modelName.includes('mini')
      ? { input: 0.15, output: 0.6 }
      : { input: 2.5, output: 10 }
  return (
    Math.round(
      ((usage.promptTokens / 1_000_000) * pricing.input +
        (usage.completionTokens / 1_000_000) * pricing.output) *
        10000,
    ) / 10000
  )
}

export async function mapAnalysisToDto(
  row: Awaited<ReturnType<typeof getAnalysisById>>,
  ctx: {
    documentTitle?: string | null
    publishedAt?: string | null
    sourceName?: string
    originalCategory?: string | null
    includeVersions?: boolean
  } = {},
): Promise<NewsDocumentAnalysisDto | null> {
  if (!row) return null
  const documentTitle = ctx.documentTitle
  const sourceName = ctx.sourceName ?? 'Prensa Libre'
  const claims = await listClaimsForAnalysis(row.id)
  const validation = (row.validation_result ?? {}) as {
    valid?: boolean
    warnings?: Array<{ message?: string; code?: string }>
    errors?: Array<{ message?: string; code?: string }>
    rejectedClaims?: unknown[]
    adjustedClaims?: unknown[]
    rejectedRelations?: unknown[]
  }

  const warningMessages = Array.isArray(validation.warnings)
    ? validation.warnings.map((w) => w.message ?? '').filter(Boolean)
    : []
  const technicalCodes = [
    ...(Array.isArray(validation.warnings) ? validation.warnings.map((w) => w.code ?? '') : []),
    ...(Array.isArray(validation.errors) ? validation.errors.map((e) => e.code ?? '') : []),
  ].filter(Boolean)

  let versionHistory: NewsDocumentAnalysisDto['version_history'] = []
  if (ctx.includeVersions) {
    const versions = await listAnalysisVersionsForDocument(row.document_id)
    versionHistory = versions.map((v) => ({
      id: v.id,
      analysis_version: v.analysis_version,
      prompt_version: v.prompt_version,
      status: v.status,
      status_label: analysisStatusLabel(v.status),
      is_active: v.id === row.id,
      created_at: v.created_at,
    }))
  }

  const temporalRefs = ((row.temporal_references as NewsDocumentAnalysisDto['temporal_references']) ?? [])
  const eventDate = temporalRefs.find(
    (t) => t.role === 'event_date' && (t.iso_date || t.iso_date_time),
  )
  // Preferir fecha de corte del balance cuando exista (noticias cuantitativas).
  const rawReportingPeriodPreview = row.reporting_period as Record<string, unknown> | null
  const cutoffPreview = (rawReportingPeriodPreview?.cutoffDate ??
    rawReportingPeriodPreview?.cutoff_date ??
    null) as string | null
  const eventDateLabel = cutoffPreview
    ? `Fecha de corte: ${formatDateEs(cutoffPreview) ?? cutoffPreview}`
    : eventDate
      ? formatDateEs(eventDate.iso_date_time ?? eventDate.iso_date) ?? eventDate.text_reference
      : 'Fecha del hecho no especificada'

  type RawFact = Parameters<typeof mapFact>[0]
  type RawEntity = {
    id: string
    mentionedName?: string
    mentioned_name?: string
    normalizedName?: string
    normalized_name?: string
    entityType?: string
    entity_type?: string
    roleInDocument?: string | null
    role_in_document?: string | null
    confidence: number
    status: string
    evidence: Parameters<typeof mapEvidence>[0]
  }
  type RawRelationship = {
    subjectEntityId?: string
    subject_entity_id?: string
    predicate: string
    objectEntityId?: string
    object_entity_id?: string
    confidence: number
    epistemicStatus?: string
    epistemic_status?: string
    evidence: Parameters<typeof mapEvidence>[0]
  }

  const primaryFact = row.primary_fact as RawFact | null
  const relatedFacts = (row.related_facts as RawFact[]) ?? []
  const entities = (row.entities as RawEntity[]) ?? []
  const relationships = (row.relationships as RawRelationship[]) ?? []

  const entityNameById = new Map<string, string>()
  for (const e of entities) {
    entityNameById.set(e.id, e.mentionedName ?? e.mentioned_name ?? '')
  }

  const rawMetrics = (row.metrics as Array<Record<string, unknown>>) ?? []
  const metrics: NewsDocumentAnalysisDto['metrics'] = rawMetrics.map((m) => {
    const rawType = String(m.metricType ?? m.metric_type ?? '')
    const label = (m.label as string) || metricTypeLabel(rawType)
    const norm = normalizeMetricType(rawType, label)
    const metricType = norm.metricType
    const value = Number(m.value ?? 0)
    const unit = (m.unit as string) ?? null
    const cutoff = (m.cutoffDate ?? m.cutoff_date ?? null) as string | null
    const sourceId = (m.sourceEntityId ?? m.source_entity_id ?? null) as string | null
    const epi = (m.epistemicStatus ?? m.epistemic_status ?? null) as string | null
    const group = metricGroup(metricType)
    return {
      id: (m.id as string) ?? null,
      metric_type: metricType,
      label: label || metricTypeLabel(metricType),
      value,
      value_label: `${Number.isInteger(value) ? value.toLocaleString('es-GT') : value}${unit ? ` ${unit}` : ''}`.trim(),
      unit,
      qualifier: (m.qualifier as string) ?? null,
      status: (m.status as string) ?? null,
      group,
      group_label: metricGroupLabel(group),
      source_name: sourceId ? entityNameById.get(sourceId) ?? null : null,
      geographic_scope: (m.geographicScope ?? m.geographic_scope ?? null) as string | null,
      cutoff_date: cutoff,
      cutoff_date_label: formatDateEs(cutoff) ?? null,
      period_start: (m.periodStart ?? m.period_start ?? null) as string | null,
      period_end: (m.periodEnd ?? m.period_end ?? null) as string | null,
      confidence: Number(m.confidence ?? 0),
      epistemic_status: epi,
      epistemic_status_label: epi ? epistemicStatusLabel(epi) : null,
      evidence: mapEvidence((m.evidence as Parameters<typeof mapEvidence>[0]) ?? []),
      highlighted: isHighlightedMetric(metricType),
    }
  })

  const rawSectors = (row.sector_relevance as Array<Record<string, unknown>>) ?? []
  const sectorRelevance: NewsDocumentAnalysisDto['sector_relevance'] = rawSectors.map((s) => ({
    sector: String(s.sector ?? ''),
    relevance: (s.relevance as string) ?? null,
    reasons: Array.isArray(s.reasons) ? s.reasons.map(String) : [],
    supporting_metrics: Array.isArray(s.supportingMetrics ?? s.supporting_metrics)
      ? ((s.supportingMetrics ?? s.supporting_metrics) as unknown[]).map(String)
      : [],
    confidence: Number(s.confidence ?? 0),
  }))

  const th = row.threat_hint as Record<string, unknown> | null
  const threatHint: NewsDocumentAnalysisDto['threat_hint'] = th
    ? {
        qualifies_for_future_evaluation: Boolean(
          th.qualifiesForFutureEvaluation ?? th.qualifies_for_future_evaluation,
        ),
        proposed_title: (th.proposedTitle ?? th.proposed_title ?? null) as string | null,
        reasons: Array.isArray(th.reasons) ? th.reasons.map(String) : [],
        missing_requirements: Array.isArray(th.missingRequirements ?? th.missing_requirements)
          ? ((th.missingRequirements ?? th.missing_requirements) as unknown[]).map(String)
          : [],
        confidence: Number(th.confidence ?? 0),
      }
    : null

  const cl = row.classification as Record<string, unknown> | null
  const classification: NewsDocumentAnalysisDto['classification'] = cl
    ? {
        original_category: ctx.originalCategory ?? null,
        primary_category: (cl.primaryCategory ?? cl.primary_category ?? null) as string | null,
        secondary_categories: Array.isArray(cl.secondaryCategories ?? cl.secondary_categories)
          ? ((cl.secondaryCategories ?? cl.secondary_categories) as unknown[]).map(String)
          : [],
      }
    : ctx.originalCategory
      ? { original_category: ctx.originalCategory, primary_category: null, secondary_categories: [] }
      : null

  const rp = row.reporting_period as Record<string, unknown> | null
  const reportingPeriod: NewsDocumentAnalysisDto['reporting_period'] = rp
    ? {
        cutoff_date: (rp.cutoffDate ?? rp.cutoff_date ?? null) as string | null,
        cutoff_date_label: formatDateEs((rp.cutoffDate ?? rp.cutoff_date ?? null) as string | null) ?? null,
        period_start: (rp.periodStart ?? rp.period_start ?? null) as string | null,
        period_end: (rp.periodEnd ?? rp.period_end ?? null) as string | null,
        cumulative: (rp.cumulative ?? null) as boolean | null,
        status: (rp.status as string) ?? null,
        text_reference: (rp.textReference ?? rp.text_reference ?? null) as string | null,
      }
    : null

  const dc = row.document_coverage as Record<string, unknown> | null
  const documentCoverage: NewsDocumentAnalysisDto['document_coverage'] = dc
    ? {
        level: ((dc.level as string) ?? 'partial') as 'sufficient' | 'partial' | 'insufficient',
        label: String(dc.label ?? 'Parcial'),
        reason: String(dc.reason ?? ''),
      }
    : null

  const rps = row.recommended_primary_source as Record<string, unknown> | null
  const recommendedPrimarySource: NewsDocumentAnalysisDto['recommended_primary_source'] = rps
    ? {
        source_type: String(rps.sourceType ?? rps.source_type ?? ''),
        reason: String(rps.reason ?? ''),
        fields_it_would_complete: Array.isArray(rps.fieldsItWouldComplete ?? rps.fields_it_would_complete)
          ? ((rps.fieldsItWouldComplete ?? rps.fields_it_would_complete) as unknown[]).map(String)
          : [],
      }
    : null

  const attributedInstitution =
    metrics.map((m) => m.source_name).find((n) => n && !/prensa|medio|fuente/i.test(n)) ??
    entities
      .filter((e) => {
        const name = `${e.mentionedName ?? e.mentioned_name ?? ''} ${e.normalizedName ?? e.normalized_name ?? ''}`
        const t = (e.entityType ?? e.entity_type ?? '').toLowerCase()
        // Solo instituciones reales (autoridad / ministerio / organismo), no grupos criminales.
        if (/pochos|c[aá]rtel|pandilla|mara|banda criminal/i.test(name)) return false
        return (
          /ministerio|conred|insivumeh|provial|pnc|igss|oms|ops|gobierno|municipalidad|organismo|tribunal|fiscal/i.test(
            name,
          ) || /institu|ministerio/.test(t)
        )
      })
      .map((e) => e.normalizedName || e.normalized_name || e.mentionedName || e.mentioned_name)
      .find(Boolean) ??
    null

  return {
    id: row.id,
    document_id: row.document_id,
    document_title: documentTitle ?? null,
    status: row.status,
    status_label: analysisStatusLabel(row.status),
    analysis_version: row.analysis_version,
    model_provider: row.model_provider,
    model_name: row.model_name,
    prompt_version: row.prompt_version,
    analytical_summary: row.analytical_summary ?? null,
    extraction_confidence: row.analysis_confidence,
    relevance_score: row.relevance_score,
    analysis_confidence: row.analysis_confidence,
    corroboration: buildCorroboration(sourceName, attributedInstitution),
    primary_fact: primaryFact ? mapFact(primaryFact) : null,
    related_facts: relatedFacts.map((f) => mapFact(f)),
    claims: claims.map(
      (c): NewsClaimDto => ({
        id: c.id,
        claim_type: c.claim_type,
        claim_type_label: claimTypeLabel(c.claim_type),
        statement: c.statement,
        epistemic_status: c.epistemic_status,
        epistemic_status_label: epistemicStatusLabel(c.epistemic_status),
        confidence: c.confidence,
        evidence: mapEvidence(
          (c.evidence_references as Array<{ field: string; excerpt: string; positionHint?: string }>) ?? [],
        ),
        validation_status: c.validation_status,
        validation_status_label:
          c.validation_status === 'rejected'
            ? 'Rechazada'
            : c.validation_status === 'adjusted'
              ? 'Ajustada'
              : c.validation_status === 'accepted'
                ? 'Aceptada'
                : 'Pendiente',
      }),
    ),
    entities: entities.map((e) => ({
      id: e.id,
      mentioned_name: e.mentionedName ?? e.mentioned_name ?? '',
      normalized_name: e.normalizedName || e.normalized_name || e.mentionedName || e.mentioned_name || '',
      entity_type: e.entityType ?? e.entity_type ?? '',
      entity_type_label: entityTypeLabel(e.entityType ?? e.entity_type ?? ''),
      entity_group: entityGroup(e.entityType ?? e.entity_type ?? ''),
      role_in_document: e.roleInDocument ?? e.role_in_document ?? null,
      confidence: e.confidence,
      status: e.status,
      status_label: ENTITY_STATUS_LABELS[e.status] ?? e.status,
      evidence: mapEvidence(e.evidence ?? []),
    })),
    relationships: relationships.map((r) => ({
      subject_entity_id: r.subjectEntityId ?? r.subject_entity_id ?? '',
      predicate: r.predicate,
      object_entity_id: r.objectEntityId ?? r.object_entity_id ?? '',
      confidence: r.confidence,
      epistemic_status: r.epistemicStatus ?? r.epistemic_status ?? 'uncertain',
      epistemic_status_label: epistemicStatusLabel(r.epistemicStatus ?? r.epistemic_status ?? 'uncertain'),
      evidence: mapEvidence(r.evidence ?? []),
    })),
    locations: ((row.locations as NewsDocumentAnalysisDto['locations']) ?? []).map((l) => ({
      ...l,
      role_label: LOCATION_ROLE_LABELS[l.role] ?? l.role,
      evidence: mapEvidence((l.evidence as Parameters<typeof mapEvidence>[0]) ?? []),
    })),
    temporal_references: temporalRefs.map((t) => ({
      ...t,
      role_label: TEMPORAL_ROLE_LABELS[t.role] ?? t.role,
      evidence: mapEvidence((t.evidence as Parameters<typeof mapEvidence>[0]) ?? []),
    })),
    publication_date: formatDateEs(ctx.publishedAt),
    event_date_label: eventDateLabel,
    uncertainties: (row.uncertainties as NewsDocumentAnalysisDto['uncertainties']) ?? [],
    unknowns: (row.unknowns as NewsDocumentAnalysisDto['unknowns']) ?? [],
    event_candidate: row.event_candidate
      ? (() => {
          const ec = row.event_candidate as {
            qualifies?: boolean
            candidateType?: string | null
            candidate_type?: string | null
            candidateTitle?: string | null
            candidate_title?: string | null
            confidence?: number
            reason?: string
            promotionRecommendation?: string
            promotion_recommendation?: string
            rootEventCandidate?: string | null
            root_event_candidate?: string | null
            documentRole?: string | null
            document_role?: string | null
            developmentType?: string | null
            development_type?: string | null
          }
          const promo = ec.promotionRecommendation ?? ec.promotion_recommendation ?? 'none'
          const docRole = ec.documentRole ?? ec.document_role ?? null
          return {
            qualifies: ec.qualifies ?? false,
            candidate_type: ec.candidateType ?? ec.candidate_type ?? null,
            candidate_title: ec.candidateTitle ?? ec.candidate_title ?? null,
            confidence: ec.confidence ?? 0,
            reason: ec.reason ?? '',
            promotion_recommendation: promo,
            promotion_recommendation_label: promotionRecommendationLabel(promo),
            root_event_candidate: ec.rootEventCandidate ?? ec.root_event_candidate ?? null,
            document_role: docRole,
            document_role_label: documentRoleLabel(docRole),
            development_type: ec.developmentType ?? ec.development_type ?? null,
          }
        })()
      : null,
    sensitivity_flags: normalizeSensitivityFlags(row.sensitivity_flags),
    metrics,
    sector_relevance: sectorRelevance,
    threat_hint: threatHint,
    classification,
    reporting_period: reportingPeriod,
    document_coverage: documentCoverage,
    recommended_primary_source: recommendedPrimarySource,
    requires_human_review: row.requires_human_review,
    review_reasons: Array.isArray(row.review_reasons) ? row.review_reasons.map(String) : [],
    review_status: row.review_status,
    review_status_label: REVIEW_STATUS_LABELS[row.review_status] ?? row.review_status,
    version_history: versionHistory,
    validation_summary: {
      valid: validation.valid ?? true,
      warning_count: Array.isArray(validation.warnings) ? validation.warnings.length : 0,
      error_count: Array.isArray(validation.errors) ? validation.errors.length : 0,
      rejected_claim_count: Array.isArray(validation.rejectedClaims) ? validation.rejectedClaims.length : 0,
      adjusted_claim_count: Array.isArray(validation.adjustedClaims) ? validation.adjustedClaims.length : 0,
      rejected_relation_count: Array.isArray(validation.rejectedRelations) ? validation.rejectedRelations.length : 0,
      warnings: warningMessages,
      technical_codes: technicalCodes,
      rejected_relations: Array.isArray(validation.rejectedRelations)
        ? (validation.rejectedRelations as NewsDocumentAnalysisDto['validation_summary']['rejected_relations'])
        : [],
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function getDocumentAnalysisDto(documentId: string): Promise<NewsDocumentAnalysisDto | null> {
  const doc = await getNewsDocumentById(documentId)
  const analysis = await getLatestAnalysisForDocument(documentId)
  if (!analysis) return null
  const sourceName = doc ? await getSourceNameForDocument(doc.source_id) : undefined
  return mapAnalysisToDto(analysis, {
    documentTitle: doc?.title,
    publishedAt: doc?.published_at ?? null,
    sourceName,
    originalCategory: doc?.source_category ?? null,
    includeVersions: true,
  })
}

export async function getAnalysisDetailDto(id: string): Promise<NewsDocumentAnalysisDto | null> {
  const analysis = await getAnalysisById(id)
  if (!analysis) return null
  const doc = await getNewsDocumentById(analysis.document_id)
  const sourceName = doc ? await getSourceNameForDocument(doc.source_id) : undefined
  return mapAnalysisToDto(analysis, {
    documentTitle: doc?.title,
    publishedAt: doc?.published_at ?? null,
    sourceName,
    originalCategory: doc?.source_category ?? null,
    includeVersions: true,
  })
}

export async function listAnalysesDto(filters: {
  requiresReview?: boolean
  limit?: number
}): Promise<NewsDocumentAnalysisDto[]> {
  const rows = await listAnalyses(filters)
  const result: NewsDocumentAnalysisDto[] = []
  for (const row of rows) {
    const doc = await getNewsDocumentById(row.document_id)
    const sourceName = doc ? await getSourceNameForDocument(doc.source_id) : undefined
    const dto = await mapAnalysisToDto(row, {
      documentTitle: doc?.title,
      publishedAt: doc?.published_at ?? null,
      sourceName,
    })
    if (dto) result.push(dto)
  }
  return result
}

export async function listReviewQueueDto(): Promise<NewsAnalysisReviewQueueItemDto[]> {
  const rows = await listAnalyses({ requiresReview: true, limit: 100 })
  const items: NewsAnalysisReviewQueueItemDto[] = []
  for (const row of rows) {
    const doc = await getNewsDocumentById(row.document_id)
    const primary = row.primary_fact as { statement?: string } | null
    items.push({
      id: row.id,
      document_id: row.document_id,
      document_title: doc?.title ?? null,
      status: row.status,
      status_label: analysisStatusLabel(row.status),
      relevance_score: row.relevance_score,
      requires_human_review: row.requires_human_review,
      review_reasons: Array.isArray(row.review_reasons) ? row.review_reasons.map(String) : [],
      sensitivity_flags: normalizeSensitivityFlags(row.sensitivity_flags),
      primary_fact_statement: primary?.statement ?? null,
      created_at: row.created_at,
    })
  }
  return items
}

async function runAnalysisForDocument(
  documentId: string,
  modelTier: NewsModelTier,
  options: { force?: boolean } = {},
): Promise<{ analysisId: string; status: string; error?: string }> {
  if (!isNewsLlmEnabled()) {
    throw new Error('Análisis con IA deshabilitado. Configure NEWS_LLM_ENABLED=true y OPENAI_API_KEY.')
  }

  const doc = await getNewsDocumentById(documentId)
  if (!doc) throw new Error('Documento no encontrado')
  if (doc.processing_status !== 'ready_for_analysis') {
    throw new Error('El documento no está listo para análisis')
  }

  const sourceName = await getSourceNameForDocument(doc.source_id)
  const permitted = buildPermittedDocumentContent(doc, sourceName)
  const inputHash = hashPermittedContent(permitted)
  const sanitized = sanitizeDocumentInputForLlm(permitted)

  const existing = await getLatestAnalysisForDocument(documentId)
  if (
    !options.force &&
    existing &&
    existing.input_hash === inputHash &&
    existing.analysis_version === ANALYSIS_SCHEMA_VERSION &&
    existing.prompt_version === ANALYSIS_PROMPT_VERSION &&
    ['completed', 'completed_with_warnings', 'needs_review'].includes(existing.status)
  ) {
    return { analysisId: existing.id, status: existing.status }
  }
  // Un cambio de esquema/prompt genera una nueva versión; la anterior queda en historial.

  const queued = await createAnalysisQueued({
    documentId,
    analysisVersion: ANALYSIS_SCHEMA_VERSION,
    promptVersion: ANALYSIS_PROMPT_VERSION,
    inputHash,
  })

  await updateAnalysis(queued.id, { status: 'processing' })

  const fastConfig = NEWS_LLM_CONFIG.fast
  const extractConfig = NEWS_LLM_CONFIG[modelTier]

  let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }

  try {
    const triage = await runTriageExtraction(fastConfig, sanitized)
    if (triage.ok) {
      totalUsage.promptTokens += triage.usage.promptTokens
      totalUsage.completionTokens += triage.usage.completionTokens
      totalUsage.totalTokens += triage.usage.totalTokens
    }

    if (triage.ok && !triage.data.warrantsFullExtraction) {
      await updateAnalysis(queued.id, {
        status: 'completed',
        model_provider: fastConfig.provider,
        model_name: fastConfig.modelName,
        relevance_score: triage.data.relevanceScore,
        analysis_confidence: triage.data.relevanceScore,
        sensitivity_flags: triage.data.sensitivityFlags,
        requires_human_review: triage.data.sensitivityFlags.length > 0,
        review_reasons: [triage.data.triageReason],
        raw_model_response: { triage: triage.raw },
        validation_result: { valid: true, triageOnly: true },
        token_usage: totalUsage,
        estimated_cost_usd: computeActualCostUsd(totalUsage, fastConfig.modelName),
      })
      return { analysisId: queued.id, status: 'completed' }
    }

    const extraction = await runFullExtraction(extractConfig, sanitized)
    if (!extraction.ok) {
      await updateAnalysis(queued.id, {
        status: 'failed',
        model_provider: extractConfig.provider,
        model_name: extractConfig.modelName,
        raw_model_response: extraction.raw ?? null,
        validation_result: { valid: false, error: extraction.error },
        token_usage: totalUsage,
      })
      return { analysisId: queued.id, status: 'failed', error: extraction.error }
    }

    totalUsage.promptTokens += extraction.usage.promptTokens
    totalUsage.completionTokens += extraction.usage.completionTokens
    totalUsage.totalTokens += extraction.usage.totalTokens

    const validation = validateAnalysisOutput(extraction.data, permitted)
    const persisted = persistableFromValidatedOutput(extraction.data, validation)

    const rejectedSet = new Set(validation.rejectedClaims.map((r) => r.statement))
    const adjustedMap = new Map(
      validation.adjustedClaims.map((a) => [a.statement, a]),
    )

    const status =
      !validation.valid
        ? 'failed'
        : validation.requiresReview || validation.warnings.length > 0
          ? validation.requiresReview
            ? 'needs_review'
            : 'completed_with_warnings'
          : 'completed'

    await updateAnalysis(queued.id, {
      status,
      model_provider: extractConfig.provider,
      model_name: extractConfig.modelName,
      relevance_score: persisted.relevanceScore,
      analysis_confidence: persisted.analysisConfidence,
      analytical_summary: persisted.analyticalSummary,
      primary_fact: persisted.primaryFact,
      related_facts: persisted.relatedFacts,
      entities: persisted.entities,
      relationships: persisted.relationships,
      locations: persisted.locations,
      temporal_references: persisted.temporalReferences,
      uncertainties: persisted.uncertainties,
      unknowns: persisted.unknowns,
      event_candidate: persisted.eventCandidate,
      sensitivity_flags: persisted.sensitivityFlags,
      metrics: persisted.metrics,
      sector_relevance: persisted.sectorRelevance,
      threat_hint: persisted.threatHint,
      classification: persisted.classification,
      reporting_period: persisted.reportingPeriod,
      document_coverage: persisted.documentCoverage,
      recommended_primary_source: persisted.recommendedPrimarySource,
      requires_human_review: persisted.requiresHumanReview,
      review_reasons: persisted.reviewReasons,
      raw_model_response: extraction.raw,
      validation_result: validation,
      token_usage: totalUsage,
      estimated_cost_usd: computeActualCostUsd(totalUsage, extractConfig.modelName),
    })

    const claimsToInsert = validation.acceptedOutput.claims.map((claim) => {
      const wasRejected = rejectedSet.has(claim.statement)
      const adjusted = adjustedMap.get(claim.statement)
      return {
        claimType: claim.claimType,
        statement: claim.statement,
        epistemicStatus: claim.epistemicStatus,
        confidence: claim.confidence,
        evidenceReferences: claim.evidence,
        subjectEntityIds: claim.subjectEntityId ? [claim.subjectEntityId] : [],
        objectEntityIds: claim.objectEntityId ? [claim.objectEntityId] : [],
        locationIds: claim.locationId ? [claim.locationId] : [],
        temporalReferenceIds: claim.temporalReferenceId ? [claim.temporalReferenceId] : [],
        quantity: claim.quantity ?? null,
        unit: claim.unit ?? null,
        sensitivity: claim.sensitivity ?? null,
        validationStatus: wasRejected
          ? 'rejected'
          : adjusted
            ? 'adjusted'
            : 'accepted',
        validationNotes: adjusted ? [adjusted] : [],
      }
    }).filter((c) => c.validationStatus !== 'rejected')

    await insertClaims(queued.id, claimsToInsert)

    return { analysisId: queued.id, status }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error interno'
    await updateAnalysis(queued.id, {
      status: 'failed',
      validation_result: { valid: false, error: message },
    })
    return { analysisId: queued.id, status: 'failed', error: message }
  }
}

export async function analyzeNewsDocumentDto(
  _auth: RequestAuthContext,
  documentId: string,
  modelTier: NewsModelTier = 'fast',
): Promise<NewsDocumentAnalysisDto> {
  const result = await runAnalysisForDocument(documentId, modelTier)
  if (result.error && result.status === 'failed') {
    throw new Error(result.error)
  }
  let dto = await getAnalysisDetailDto(result.analysisId)
  if (!dto) throw new Error('No se pudo cargar el análisis')

  // Escalamiento selectivo fast → deep (conserva el resultado fast en historial).
  if (modelTier === 'fast') {
    const reasons = shouldEscalateToDeep(dto)
    if (reasons.length > 0) {
      const deepResult = await runAnalysisForDocument(documentId, 'deep', { force: true })
      if (!(deepResult.error && deepResult.status === 'failed')) {
        const deepDto = await getAnalysisDetailDto(deepResult.analysisId)
        if (deepDto) {
          // Registrar motivo de escalamiento en review_reasons (trazable, visible).
          const note = `Escalado a modelo profundo: ${reasons.join('; ')}`
          if (!deepDto.review_reasons.includes(note)) {
            await updateAnalysis(deepResult.analysisId, {
              review_reasons: [...deepDto.review_reasons, note],
            })
          }
          dto = (await getAnalysisDetailDto(deepResult.analysisId)) ?? deepDto
        }
      }
    }
  }

  return dto
}

export async function batchAnalyzeDryRunDto(input: {
  documentIds?: string[]
  limit?: number
  modelTier?: NewsModelTier
}): Promise<NewsAnalysisBatchDryRunDto> {
  const modelTier = input.modelTier ?? 'fast'
  const config = NEWS_LLM_CONFIG[modelTier]
  const limit = input.limit ?? 5

  const { rows } = await listNewsDocuments({ processingStatus: 'ready_for_analysis', limit: 100 })
  let candidates = rows

  if (input.documentIds?.length) {
    const fetched = []
    for (const id of input.documentIds) {
      const doc = await getNewsDocumentById(id)
      if (doc) fetched.push(doc)
    }
    candidates = fetched
  }

  const eligible: NewsAnalysisBatchDryRunDto['eligible_documents'] = []
  const alreadyAnalyzed: NewsAnalysisBatchDryRunDto['already_analyzed'] = []
  const skipped: NewsAnalysisBatchDryRunDto['skipped_not_ready'] = []

  for (const doc of candidates) {
    if (eligible.length >= limit) break
    if (doc.processing_status !== 'ready_for_analysis') {
      skipped.push({ id: doc.id, title: doc.title, reason: 'No listo para análisis' })
      continue
    }
    const latest = await getLatestAnalysisForDocument(doc.id)
    if (latest && ['completed', 'completed_with_warnings', 'needs_review'].includes(latest.status)) {
      alreadyAnalyzed.push({ id: doc.id, title: doc.title, analysis_id: latest.id })
      if (!input.documentIds?.includes(doc.id)) continue
    }
    eligible.push({ id: doc.id, title: doc.title })
  }

  let totalInput = 0
  for (const e of eligible) {
    const doc = await getNewsDocumentById(e.id)
    if (!doc) continue
    const sourceName = await getSourceNameForDocument(doc.source_id)
    const permitted = buildPermittedDocumentContent(doc, sourceName)
    totalInput += sanitizeDocumentInputForLlm(permitted).length
  }

  const cost = estimateAnalysisCost('x'.repeat(totalInput), config.modelName, 2)

  return {
    eligible_documents: eligible,
    already_analyzed: alreadyAnalyzed,
    skipped_not_ready: skipped,
    estimated_input_tokens: cost.inputTokens,
    estimated_output_tokens: cost.outputTokens,
    estimated_cost_usd: cost.estimatedCostUsd,
    model_tier: modelTier,
    model_name: config.modelName,
    warnings: !isNewsLlmEnabled()
      ? ['NEWS_LLM_ENABLED no está activo o falta OPENAI_API_KEY']
      : [],
  }
}

export async function batchAnalyzeDto(
  _auth: RequestAuthContext,
  input: {
    documentIds?: string[]
    limit?: number
    dryRun?: boolean
    modelTier?: NewsModelTier
    estimatedCostConfirmation?: boolean
  },
): Promise<NewsAnalysisBatchResultDto> {
  if (input.dryRun) {
    const dry = await batchAnalyzeDryRunDto(input)
    return {
      dry_run: true,
      processed: 0,
      failed: 0,
      results: dry.eligible_documents.map((d) => ({
        document_id: d.id,
        analysis_id: null,
        status: 'dry_run',
      })),
      total_estimated_cost_usd: dry.estimated_cost_usd,
    }
  }

  if (!input.estimatedCostConfirmation) {
    throw new Error('Se requiere confirmación explícita de costo estimado (estimatedCostConfirmation=true)')
  }

  const dry = await batchAnalyzeDryRunDto(input)
  const results: NewsAnalysisBatchResultDto['results'] = []
  let processed = 0
  let failed = 0
  let totalCost = 0

  for (const doc of dry.eligible_documents) {
    const r = await runAnalysisForDocument(doc.id, input.modelTier ?? 'fast')
    if (r.status === 'failed') {
      failed++
      results.push({ document_id: doc.id, analysis_id: r.analysisId, status: r.status, error: r.error })
    } else {
      processed++
      results.push({ document_id: doc.id, analysis_id: r.analysisId, status: r.status })
      const analysis = await getAnalysisById(r.analysisId)
      if (analysis?.estimated_cost_usd) totalCost += analysis.estimated_cost_usd
    }
  }

  return {
    dry_run: false,
    processed,
    failed,
    results,
    total_estimated_cost_usd: dry.estimated_cost_usd,
    total_actual_cost_usd: Math.round(totalCost * 10000) / 10000,
  }
}

export async function reviewAnalysisDto(
  auth: RequestAuthContext,
  analysisId: string,
  action: 'approve' | 'reject',
  notes?: string,
): Promise<NewsDocumentAnalysisDto> {
  const analysis = await getAnalysisById(analysisId)
  if (!analysis) throw new Error('Análisis no encontrado')

  const reviewStatus = action === 'approve' ? 'approved' : 'rejected'
  const status = action === 'approve' ? 'completed' : 'rejected'

  await updateAnalysis(analysisId, {
    review_status: reviewStatus,
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
    status,
    review_reasons: notes
      ? [...(Array.isArray(analysis.review_reasons) ? analysis.review_reasons.map(String) : []), notes]
      : analysis.review_reasons,
    requires_human_review: action !== 'approve',
  })

  const dto = await getAnalysisDetailDto(analysisId)
  if (!dto) throw new Error('No se pudo cargar el análisis')
  return dto
}

export async function rejectAnalysisDto(
  auth: RequestAuthContext,
  analysisId: string,
  reason?: string,
): Promise<NewsDocumentAnalysisDto> {
  return reviewAnalysisDto(auth, analysisId, 'reject', reason)
}
