/**
 * Esquema estructurado de salida IA — Bloque N2.
 * La IA comprende; Zod + validadores impiden persistir invenciones.
 */
import { z } from 'zod'

export const ANALYSIS_PROMPT_VERSION = 'document-analysis.v2.4'
export const ANALYSIS_SCHEMA_VERSION = 'ai-output.v2'

/** Confianza de extracción: qué tan seguro está el sistema de interpretar el texto. */
const confidence = z.number().min(0).max(1)

/**
 * Campo de evidencia. Se acepta cualquier nombre que devuelva el modelo, pero
 * los validadores determinísticos exigen que el fragmento exista realmente en
 * el contenido permitido (aunque el campo declarado no coincida).
 */
export const evidenceReferenceSchema = z.object({
  field: z.string().min(1).max(60),
  excerpt: z.string().min(1).max(2000),
  positionHint: z.string().max(200).optional().nullable(),
})

const epistemicStatusEnum = z.enum([
  'explicitly_reported',
  'attributed_report',
  'inferred',
  'uncertain',
  'contradicted',
])

export const factSchema = z.object({
  factType: z.string().min(1).max(80),
  statement: z.string().min(1).max(2000),
  confidence,
  epistemicStatus: epistemicStatusEnum.optional(),
  evidence: z.array(evidenceReferenceSchema).min(1),
})

export const claimOutputSchema = z.object({
  id: z.string().max(80).optional(),
  claimType: z.enum([
    'action',
    'state',
    'decision',
    'change',
    'measurement',
    'consequence',
    'allegation',
    'prediction',
    'denial',
    'confirmation',
    'relationship',
  ]),
  statement: z.string().min(1).max(2000),
  epistemicStatus: z.enum([
    'explicitly_reported',
    'attributed_report',
    'inferred',
    'uncertain',
    'contradicted',
  ]),
  confidence,
  evidence: z.array(evidenceReferenceSchema).min(1),
  subjectEntityId: z.string().max(80).optional().nullable(),
  objectEntityId: z.string().max(80).optional().nullable(),
  locationId: z.string().max(80).optional().nullable(),
  temporalReferenceId: z.string().max(80).optional().nullable(),
  quantity: z.number().optional().nullable(),
  unit: z.string().max(40).optional().nullable(),
  sensitivity: z.string().max(80).optional().nullable(),
})

export const entityOutputSchema = z.object({
  id: z.string().min(1).max(80),
  mentionedName: z.string().min(1).max(500),
  // Puede venir vacío para entidades anónimas por rol; se normaliza luego.
  normalizedName: z.string().max(500).optional().nullable().default(''),
  entityType: z.string().min(1).max(80),
  roleInDocument: z.string().max(500).optional().nullable(),
  confidence,
  // Entidades anónimas por rol pueden no traer evidencia textual literal.
  evidence: z.array(evidenceReferenceSchema).optional().default([]),
  status: z.enum(['confirmed_in_text', 'candidate', 'inferred']),
})

export const relationshipOutputSchema = z.object({
  subjectEntityId: z.string().min(1).max(80),
  predicate: z.string().min(1).max(200),
  objectEntityId: z.string().min(1).max(80),
  confidence,
  evidence: z.array(evidenceReferenceSchema).optional().default([]),
  epistemicStatus: z.enum([
    'explicitly_reported',
    'attributed_report',
    'inferred',
    'uncertain',
    'contradicted',
  ]),
})

export const locationOutputSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(500),
  role: z.enum([
    'primary_event',
    'mentioned',
    'person_origin',
    'institutional_seat',
    'potentially_affected',
    'national_coverage',
    'international',
  ]),
  departmentCode: z.string().max(10).optional().nullable(),
  confidence,
  evidence: z.array(evidenceReferenceSchema).optional().default([]),
})

export const temporalReferenceSchema = z.object({
  id: z.string().min(1).max(80),
  role: z.enum([
    'event_date',
    'reported_date',
    'antecedent_date',
    'estimated',
    'future_horizon',
    'relative',
    'unspecified',
  ]),
  isoDate: z.string().max(40).optional().nullable(),
  isoDateTime: z.string().max(40).optional().nullable(),
  textReference: z.string().max(500).optional().default(''),
  precision: z.enum(['exact', 'day', 'month', 'year', 'relative', 'unknown']),
  confidence,
  evidence: z.array(evidenceReferenceSchema).optional().default([]),
})

export const uncertaintySchema = z.object({
  statement: z.string().min(1).max(1000),
  reason: z.string().min(1).max(1000),
  evidence: z.array(evidenceReferenceSchema).optional(),
})

export const unknownSchema = z.object({
  category: z.string().min(1).max(80),
  description: z.string().min(1).max(1000),
  evidence: z.array(evidenceReferenceSchema).optional(),
})

/**
 * Sensibilidad explicada: motivo y consecuencia, no solo un código.
 * Se acepta string (compatibilidad) u objeto estructurado.
 */
export const sensitivityFlagSchema = z.union([
  z.string().min(1).max(80),
  z.object({
    code: z.string().min(1).max(80),
    reason: z.string().max(500).optional().nullable(),
    consequence: z.string().max(500).optional().nullable(),
  }),
])

export const documentRoleEnum = z.enum([
  'initial_report',
  'update',
  'official_confirmation',
  'consequence_report',
  'judicial_development',
  'institutional_balance',
  'correction',
  'background',
  'opinion',
])

export const eventCandidateSchema = z.object({
  qualifies: z.boolean(),
  candidateType: z.string().max(120).optional().nullable(),
  candidateTitle: z.string().max(500).optional().nullable(),
  confidence,
  reason: z.string().max(2000),
  promotionRecommendation: z.enum([
    'none',
    'needs_related_documents',
    'ready_for_grouping',
    'human_review_required',
  ]),
  // Evento raíz vs. actualización: la resolución es un desarrollo, no el evento raíz.
  rootEventCandidate: z.string().max(500).optional().nullable(),
  documentRole: documentRoleEnum.optional().nullable(),
  developmentType: z.string().max(300).optional().nullable(),
})

/**
 * Métrica documental estructurada (aditiva y opcional).
 * Para noticias cuantitativas/institucionales; las narrativas pueden omitirla.
 */
export const documentMetricSchema = z.object({
  id: z.string().max(80).optional(),
  metricType: z.string().min(1).max(80),
  label: z.string().min(1).max(200),
  value: z.number(),
  unit: z.string().max(60).optional().nullable(),
  qualifier: z.string().max(200).optional().nullable(),
  status: z.string().max(60).optional().nullable(),
  sourceEntityId: z.string().max(80).optional().nullable(),
  evidence: z.array(evidenceReferenceSchema).optional().default([]),
  geographicScope: z.string().max(200).optional().nullable(),
  periodStart: z.string().max(40).optional().nullable(),
  periodEnd: z.string().max(40).optional().nullable(),
  cutoffDate: z.string().max(40).optional().nullable(),
  confidence,
  epistemicStatus: epistemicStatusEnum.optional(),
  comparisonRole: z.string().max(80).optional().nullable(),
})

/** Relevancia sectorial preliminar (NO evaluación ministerial). */
export const potentialSectorRelevanceSchema = z.object({
  sector: z.string().min(1).max(120),
  relevance: z.string().max(60).optional().nullable(),
  reasons: z.array(z.string().max(500)).optional().default([]),
  supportingMetrics: z.array(z.string().max(80)).optional().default([]),
  confidence,
})

/** Indicador preliminar para evaluación futura de amenaza. NO persiste amenaza. */
export const threatEvaluationHintSchema = z.object({
  qualifiesForFutureEvaluation: z.boolean(),
  proposedTitle: z.string().max(500).optional().nullable(),
  reasons: z.array(z.string().max(500)).optional().default([]),
  missingRequirements: z.array(z.string().max(500)).optional().default([]),
  confidence,
})

/** Clasificación analítica multietiqueta (independiente de la categoría del medio). */
export const analyticalClassificationSchema = z.object({
  primaryCategory: z.string().max(120).optional().nullable(),
  secondaryCategories: z.array(z.string().max(120)).optional().default([]),
})

/** Periodo / fecha de corte del balance (para noticias acumulativas). */
export const reportingPeriodSchema = z.object({
  cutoffDate: z.string().max(40).optional().nullable(),
  periodStart: z.string().max(40).optional().nullable(),
  periodEnd: z.string().max(40).optional().nullable(),
  cumulative: z.boolean().optional().nullable(),
  status: z.string().max(120).optional().nullable(),
  textReference: z.string().max(500).optional().nullable(),
})

/** Cobertura del corpus permitido para este análisis. */
export const documentCoverageSchema = z.object({
  level: z.enum(['sufficient', 'partial', 'insufficient']),
  label: z.string().max(120),
  reason: z.string().max(1000),
})

/** Fuente primaria recomendada — no se busca ni descarga en N2. */
export const recommendedPrimarySourceSchema = z.object({
  sourceType: z.string().min(1).max(200),
  reason: z.string().min(1).max(1000),
  fieldsItWouldComplete: z.array(z.string().max(200)).optional().default([]),
})

export const documentRelevanceSchema = z.object({
  score: confidence,
  reason: z.string().min(1).max(2000),
  dimensions: z
    .object({
      publicInterest: z.number().min(0).max(1).optional(),
      territorialScope: z.number().min(0).max(1).optional(),
      humanImpact: z.number().min(0).max(1).optional(),
      economicImpact: z.number().min(0).max(1).optional(),
      institutionalImpact: z.number().min(0).max(1).optional(),
      continuity: z.number().min(0).max(1).optional(),
      updatePotential: z.number().min(0).max(1).optional(),
    })
    .optional(),
  potentialMinistries: z.array(z.string().max(120)).optional(),
})

export const aiAnalysisOutputSchema = z.object({
  analyticalSummary: z.string().max(2000).optional().nullable(),
  documentRelevance: documentRelevanceSchema,
  primaryFact: factSchema.nullable(),
  relatedFacts: z.array(factSchema),
  claims: z.array(claimOutputSchema),
  entities: z.array(entityOutputSchema),
  relationships: z.array(relationshipOutputSchema),
  locations: z.array(locationOutputSchema),
  temporalReferences: z.array(temporalReferenceSchema),
  uncertainties: z.array(uncertaintySchema),
  unknowns: z.array(unknownSchema),
  eventCandidate: eventCandidateSchema,
  sensitivityFlags: z.array(sensitivityFlagSchema),
  requiresHumanReview: z.boolean(),
  reviewReasons: z.array(z.string().max(500)),
  // Extensiones aditivas v2.3+ (opcionales; las narrativas pueden omitirlas).
  metrics: z.array(documentMetricSchema).optional(),
  sectorRelevance: z.array(potentialSectorRelevanceSchema).optional(),
  threatHint: threatEvaluationHintSchema.optional().nullable(),
  classification: analyticalClassificationSchema.optional().nullable(),
  reportingPeriod: reportingPeriodSchema.optional().nullable(),
  documentCoverage: documentCoverageSchema.optional().nullable(),
  recommendedPrimarySource: recommendedPrimarySourceSchema.optional().nullable(),
})

export type AiAnalysisOutput = z.infer<typeof aiAnalysisOutputSchema>
export type EvidenceReference = z.infer<typeof evidenceReferenceSchema>

/** Triage rápido (primera pasada). */
export const aiTriageOutputSchema = z.object({
  hasStructurableFacts: z.boolean(),
  relevanceScore: confidence,
  relevanceReason: z.string().max(2000),
  sensitivityFlags: z.array(z.string().max(80)),
  warrantsFullExtraction: z.boolean(),
  triageReason: z.string().max(2000),
})

export type AiTriageOutput = z.infer<typeof aiTriageOutputSchema>

export function parseAiAnalysisOutput(raw: unknown): {
  ok: true
  data: AiAnalysisOutput
} | {
  ok: false
  error: string
} {
  const parsed = aiAnalysisOutputSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? 'Esquema de análisis inválido' }
  }
  return { ok: true, data: parsed.data }
}

export function parseAiTriageOutput(raw: unknown): {
  ok: true
  data: AiTriageOutput
} | {
  ok: false
  error: string
} {
  const parsed = aiTriageOutputSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: issue?.message ?? 'Esquema de triaje inválido' }
  }
  return { ok: true, data: parsed.data }
}
