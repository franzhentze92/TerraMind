/**
 * Validadores determinísticos — la IA propone; las reglas impiden inventar.
 */
import type { AiAnalysisOutput } from '../schemas/ai-analysis.schema'
import type { PermittedDocumentContent } from './build-permitted-content'
import {
  buildEvidenceCorpus,
  excerptExistsInCorpus,
  normalizeForEvidenceMatch,
} from './build-permitted-content'
import { classifyEntityCategory, validateRelationSemantics } from './relation-semantics'

export interface ValidationIssue {
  /** Mensaje humanizado, apto para el analista (español). */
  message: string
  /** Código técnico interno (para logs / detalle colapsable). No mostrar en vista principal. */
  code: string
  path?: string
}

/** Límite de confianza de extracción visible: nunca 100 %. */
export const MAX_EXTRACTION_CONFIDENCE = 0.97

export function capExtractionConfidence(value: number): number {
  return Math.min(Math.max(value, 0), MAX_EXTRACTION_CONFIDENCE)
}

export interface RejectedClaim {
  statement: string
  reason: string
}

export interface AdjustedClaim {
  statement: string
  originalEpistemicStatus: string
  adjustedEpistemicStatus: string
  reason: string
}

export interface RejectedRelation {
  subject: string
  predicate: string
  object: string
  reason: string
}

export interface AnalysisValidationResult {
  valid: boolean
  warnings: ValidationIssue[]
  errors: ValidationIssue[]
  rejectedClaims: RejectedClaim[]
  adjustedClaims: AdjustedClaim[]
  rejectedRelations: RejectedRelation[]
  adjustedMetrics: MetricTypeNormalization[]
  requiresReview: boolean
  acceptedOutput: AiAnalysisOutput
}

const CULPABILITY_PATTERNS = [
  /\bculpable\b/i,
  /\bresponsable del (accidente|hecho|delito)\b/i,
  /\bcausó (el|la) (accidente|colisión|choque)\b/i,
  /\bprovocó (el|la) (accidente|colisión)\b/i,
  /\bcometió (el|el) delito\b/i,
]

const SENSITIVE_AUTO_REVIEW = new Set([
  'legal_allegation',
  'criminal_proceeding',
  'fatality',
  'minor',
  'corruption_allegation',
  'unverified_accusation',
  'violence',
  'natural_disaster',
  'missing_persons',
])

/** Extrae números (con separadores de miles y expresiones en español “X mil”). */
export function extractNumbersFromText(text: string): number[] {
  const out: number[] = []
  // "5 mil 994" → 5994 (compuesto), luego "29 mil" → 29000.
  let working = text
  working = working.replace(/(?<![\d.,])(\d{1,3})\s*mil\s+(\d{1,3})\b/gi, (_m, a, b) => {
    out.push(Number(a) * 1000 + Number(b))
    return ' '
  })
  working = working.replace(/(?<![\d.,])(\d{1,3})\s*mil\b/gi, (_m, a) => {
    out.push(Number(a) * 1000)
    return ' '
  })
  const matches = working.match(/\d{1,3}(?:[.,]\d{3})+|\d+(?:\.\d+)?/g)
  if (matches) {
    for (const m of matches) {
      const cleaned = m.replace(/[.,](?=\d{3}\b)/g, '')
      const n = Number(cleaned.replace(',', '.'))
      if (Number.isFinite(n)) out.push(n)
    }
  }
  return out
}

/** ¿La cifra aparece en el corpus (tolerando separadores de miles)? */
export function valueAppearsInCorpus(value: number, corpusText: string): boolean {
  const corpusNumbers = new Set(extractNumbersFromText(corpusText))
  if (corpusNumbers.has(value)) return true
  // Tolerancia por redondeo textual ("casi 6 mil", "más de 29 mil").
  return hasCloseMetric(value, corpusNumbers)
}

/** Coincidencia aproximada (±1% o valores redondeados como 6000 vs 5994). */
function hasCloseMetric(value: number, pool: Set<number>): boolean {
  for (const p of pool) {
    if (p === value) return true
    const diff = Math.abs(p - value)
    if (value >= 1000 && diff / value <= 0.02) return true
  }
  return false
}

export interface MetricTypeNormalization {
  id: string | null
  label: string
  originalType: string
  normalizedType: string
  reason: string
}

/**
 * Normaliza metricType según la etiqueta visible.
 * "Familias damnificadas" ≠ "Familias afectadas".
 */
export function normalizeMetricType(
  metricType: string,
  label: string,
): { metricType: string; changed: boolean; reason: string } {
  const t = (metricType ?? '').toLowerCase().trim()
  const l = (label ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

  const isDamnificada = /damnificad/.test(l)
  const isAfectadaFamily = /famili/.test(l) && /afectad/.test(l) && !isDamnificada

  if (isDamnificada && t !== 'disaster_affected_families') {
    return {
      metricType: 'disaster_affected_families',
      changed: true,
      reason: 'La etiqueta indica familias damnificadas; no familias afectadas.',
    }
  }
  if (isAfectadaFamily && t === 'disaster_affected_families') {
    return {
      metricType: 'affected_families',
      changed: true,
      reason: 'La etiqueta indica familias afectadas; no damnificadas.',
    }
  }
  // Si el tipo dice affected_families pero la etiqueta dice damnificadas (caso residual).
  if (t === 'affected_families' && isDamnificada) {
    return {
      metricType: 'disaster_affected_families',
      changed: true,
      reason: 'metricType affected_families corregido a disaster_affected_families por la etiqueta.',
    }
  }
  return { metricType: t || metricType, changed: false, reason: '' }
}

function hasCulpabilityLanguage(text: string): boolean {
  return CULPABILITY_PATTERNS.some((p) => p.test(text))
}

/**
 * Conectores que suelen unir varias proposiciones separables en una sola afirmación.
 * Se usa para advertir falta de atomicidad, no para dividir mecánicamente.
 */
/** Conectores fuertes: introducen una proposición separable por sí solos. */
const STRONG_CONNECTORS: RegExp[] = [
  /,?\s+donde\s+/i,
  /\s+además\s+/i,
  /\s+debido a\s+/i,
  /\s+que caus[óo]\s+/i,
  /,\s+en el que\s+/i,
]

/** Conectores débiles: solo cuentan si hay varios verbos (indicio de varias oraciones). */
const WEAK_CONNECTORS: RegExp[] = [
  /\s+y\s+/i,
  /,\s+(?:el|la|los|las|quien|quienes)\s+/i,
]

function countVerbLikeTokens(text: string): number {
  // Heurística ligera: verbos frecuentes en afirmaciones periodísticas.
  const verbs = /\b(dict[óo]|determin[óo]|recib[ií]|muri[óo]|falleci[óo]|ocurri[óo]|provoc[óo]|caus[óo]|anunci[óo]|confirm[óo]|captur[óo]|detuv|resolvi[óo]|estaba|fue|volc[óo]|impact[óo]|proces|existen?)\w*/gi
  const matches = text.match(verbs)
  return matches ? matches.length : 0
}

export function isLikelyNonAtomic(statement: string): boolean {
  if (STRONG_CONNECTORS.some((p) => p.test(statement))) return true
  const hasWeakConnector = WEAK_CONNECTORS.some((p) => p.test(statement))
  return hasWeakConnector && countVerbLikeTokens(statement) >= 2
}

/**
 * Para entidades anónimas ("Jueza no identificada"), basta que el rol
 * aparezca en el texto ("jueza"); no exige la frase completa.
 */
function entityMentionedInCorpus(name: string, corpusText: string): boolean {
  const normalized = normalizeForEvidenceMatch(name)
  if (normalized.length < 3) return false
  const corpusNorm = normalizeForEvidenceMatch(corpusText)
  if (corpusNorm.includes(normalized)) return true

  const anonymous = normalized.match(/^(.+?)\s+no identificad/)
  if (anonymous?.[1]) {
    const role = anonymous[1].trim()
    if (role.length >= 3 && corpusNorm.includes(role)) return true
  }
  return false
}

function getFullCorpusText(corpus: Record<string, string>): string {
  return Object.values(corpus).join('\n')
}

function validateEvidenceList(
  evidence: Array<{ field: string; excerpt: string }>,
  corpus: Record<string, string>,
  path: string,
  issues: ValidationIssue[],
): boolean {
  let ok = true
  for (const [i, ev] of evidence.entries()) {
    if (!excerptExistsInCorpus(ev.field, ev.excerpt, corpus)) {
      ok = false
      const isDateField = /fecha|date|publish/i.test(ev.field)
      issues.push({
        message: isDateField
          ? 'La fecha de publicación no confirma la fecha en que ocurrió el hecho.'
          : 'Un fragmento de evidencia no pudo verificarse en el contenido disponible.',
        code: `evidence_not_found:${ev.field}`,
        path: `${path}.evidence[${i}]`,
      })
    }
  }
  return ok
}

export function validateAnalysisOutput(
  output: AiAnalysisOutput,
  content: PermittedDocumentContent,
): AnalysisValidationResult {
  const corpus = buildEvidenceCorpus(content)
  const fullCorpus = getFullCorpusText(corpus)
  const warnings: ValidationIssue[] = []
  const errors: ValidationIssue[] = []
  const rejectedClaims: RejectedClaim[] = []
  const adjustedClaims: AdjustedClaim[] = []
  const rejectedRelations: RejectedRelation[] = []
  const adjustedMetrics: MetricTypeNormalization[] = []
  let requiresReview = output.requiresHumanReview

  const accepted: AiAnalysisOutput = structuredClone(output)

  if (output.documentRelevance.score < 0 || output.documentRelevance.score > 1) {
    errors.push({ code: 'invalid_relevance', message: 'La relevancia documental está fuera de rango.' })
  }

  const isJusticeContext =
    content.sourceCategory?.toLowerCase().includes('justicia') ?? false

  if (accepted.primaryFact) {
    accepted.primaryFact.confidence = capExtractionConfidence(accepted.primaryFact.confidence)
    const factOk = validateEvidenceList(
      accepted.primaryFact.evidence,
      corpus,
      'primaryFact',
      errors,
    )
    if (!factOk) {
      warnings.push({
        message: 'El hecho principal no tiene evidencia suficiente en el texto disponible.',
        code: 'primary_fact_weak_evidence',
      })
      requiresReview = true
    }
    if (hasCulpabilityLanguage(accepted.primaryFact.statement) && isJusticeContext) {
      warnings.push({
        message: 'El hecho principal usa lenguaje de culpabilidad en una noticia judicial; debe presentarse con prudencia.',
        code: 'prudent_language',
      })
      requiresReview = true
    }
  }

  // Hechos relacionados: capar confianza y validar evidencia.
  for (const fact of accepted.relatedFacts) {
    fact.confidence = capExtractionConfidence(fact.confidence)
    validateEvidenceList(fact.evidence, corpus, 'relatedFacts', warnings)
  }

  const keptClaims: typeof accepted.claims = []
  for (const claim of accepted.claims) {
    const evidenceOk = validateEvidenceList(claim.evidence, corpus, 'claims', errors)
    let epistemic = claim.epistemicStatus
    let confidence = capExtractionConfidence(claim.confidence)

    if (!evidenceOk) {
      if (claim.epistemicStatus === 'explicitly_reported') {
        rejectedClaims.push({
          statement: claim.statement,
          reason: 'Sin evidencia textual suficiente para presentarla como reportada.',
        })
        continue
      }
      epistemic = 'uncertain'
      confidence = Math.min(confidence, 0.35)
      adjustedClaims.push({
        statement: claim.statement,
        originalEpistemicStatus: claim.epistemicStatus,
        adjustedEpistemicStatus: epistemic,
        reason: 'Evidencia insuficiente — degradada a incierta.',
      })
    }

    if (hasCulpabilityLanguage(claim.statement) && epistemic === 'explicitly_reported') {
      epistemic = 'attributed_report'
      confidence = Math.min(confidence, 0.6)
      adjustedClaims.push({
        statement: claim.statement,
        originalEpistemicStatus: claim.epistemicStatus,
        adjustedEpistemicStatus: epistemic,
        reason: 'Lenguaje de culpabilidad — no se presenta como reportado explícitamente.',
      })
      requiresReview = true
    }

    if (isLikelyNonAtomic(claim.statement)) {
      warnings.push({
        message: 'Una afirmación combina varios hechos; conviene separarla para poder corroborarla.',
        code: 'claim_not_atomic',
      })
      requiresReview = true
    }

    keptClaims.push({ ...claim, epistemicStatus: epistemic, confidence })
  }
  accepted.claims = keptClaims

  const keptEntities: typeof accepted.entities = []
  for (const entity of accepted.entities) {
    entity.confidence = capExtractionConfidence(entity.confidence)
    const isAnonymousRole = /no identificad/i.test(entity.mentionedName)
    const mentioned = entityMentionedInCorpus(entity.mentionedName, fullCorpus)
    const category = classifyEntityCategory(entity.entityType)
    // Los nodos analíticos (hecho, decisión, consecuencia) son construcciones del
    // análisis; no se espera que aparezcan literalmente. Se dejan como candidatos
    // sin advertencia, siempre que su evidencia exista.
    const isAnalyticalNode = category === 'event' || category === 'decision' || category === 'consequence'

    if ((isAnonymousRole || isAnalyticalNode) && entity.status === 'confirmed_in_text') {
      keptEntities.push({ ...entity, status: 'candidate' })
      continue
    }

    if (entity.status === 'confirmed_in_text' && !mentioned) {
      warnings.push({
        message: `La entidad "${entity.mentionedName}" no aparece literalmente en el texto; se marca como candidata.`,
        code: 'entity_not_mentioned',
        path: `entities.${entity.id}`,
      })
      keptEntities.push({ ...entity, status: 'candidate', confidence: Math.min(entity.confidence, 0.4) })
    } else {
      const evOk = validateEvidenceList(entity.evidence, corpus, `entities.${entity.id}`, warnings)
      if (!evOk && entity.status === 'confirmed_in_text') {
        keptEntities.push({ ...entity, status: 'inferred', confidence: Math.min(entity.confidence, 0.35) })
      } else {
        keptEntities.push(entity)
      }
    }
  }
  accepted.entities = keptEntities

  const entityCategoryById = new Map<string, ReturnType<typeof classifyEntityCategory>>()
  const entityNameById = new Map<string, string>()
  for (const e of accepted.entities) {
    entityCategoryById.set(e.id, classifyEntityCategory(e.entityType))
    entityNameById.set(e.id, e.mentionedName)
  }
  // Las ubicaciones viven en su propia lista pero pueden ser objeto de relaciones
  // (p. ej. "accidente → ocurrió en → Zona 15"). Se incluyen como categoría 'place'.
  for (const loc of accepted.locations) {
    if (!entityCategoryById.has(loc.id)) {
      entityCategoryById.set(loc.id, 'place')
      entityNameById.set(loc.id, loc.name)
    }
  }

  const keptRelations: typeof accepted.relationships = []
  for (const rel of accepted.relationships) {
    rel.confidence = capExtractionConfidence(rel.confidence)
    validateEvidenceList(rel.evidence, corpus, 'relationships', warnings)

    if (hasCulpabilityLanguage(rel.predicate) && rel.epistemicStatus === 'explicitly_reported') {
      requiresReview = true
      warnings.push({
        message: 'Una relación atribuye causalidad o culpabilidad sin respaldo prudente.',
        code: 'relationship_culpability',
      })
    }

    // Compatibilidad semántica sujeto → predicado → objeto.
    const subjCat = entityCategoryById.get(rel.subjectEntityId) ?? 'unknown'
    const objId = rel.objectEntityId
    if (objId && entityCategoryById.has(objId)) {
      const objCat = entityCategoryById.get(objId)!
      const semantic = validateRelationSemantics(subjCat, rel.predicate, objCat)
      const subjName = entityNameById.get(rel.subjectEntityId) ?? rel.subjectEntityId
      const objName = entityNameById.get(objId) ?? objId

      if (semantic.status === 'invalid') {
        rejectedRelations.push({
          subject: subjName,
          predicate: rel.predicate,
          object: objName,
          reason: semantic.message,
        })
        warnings.push({ message: semantic.message, code: semantic.code, path: 'relationships' })
        requiresReview = true
        continue // se descarta la relación incompatible
      }
      if (semantic.status === 'suspicious') {
        warnings.push({ message: semantic.message, code: semantic.code, path: 'relationships' })
        requiresReview = true
      }
    }

    keptRelations.push(rel)
  }
  accepted.relationships = keptRelations

  for (const loc of accepted.locations) {
    loc.confidence = capExtractionConfidence(loc.confidence)
    validateEvidenceList(loc.evidence, corpus, `locations.${loc.id}`, warnings)
  }

  for (const temp of accepted.temporalReferences) {
    temp.confidence = capExtractionConfidence(temp.confidence)
    validateEvidenceList(temp.evidence, corpus, `temporalReferences.${temp.id}`, warnings)
    if (temp.role === 'event_date' && temp.isoDate && temp.isoDate === content.publishedAt?.slice(0, 10)) {
      // En balances institucionales, la fecha de corte suele coincidir con el día de
      // publicación ("hasta el 12 de julio"). Conservar como fecha reportada/corte.
      if (/hasta|corte|balance|al\s+\d{1,2}/i.test(temp.textReference ?? '')) {
        temp.role = 'reported_date'
        warnings.push({
          message: 'La fecha coincide con la publicación; se conserva como fecha de corte del balance reportado.',
          code: 'event_date_reclassified_as_cutoff',
        })
      } else {
        warnings.push({
          message: 'La fecha de publicación no confirma la fecha en que ocurrió el hecho.',
          code: 'event_date_equals_publication',
        })
        temp.isoDate = null
        temp.isoDateTime = null
        temp.role = 'unspecified'
        temp.precision = 'unknown'
        requiresReview = true
      }
    }
  }

  // Métricas cuantitativas: consistencia numérica y anti-invención (aditivo).
  if (Array.isArray(accepted.metrics) && accepted.metrics.length > 0) {
    const seen = new Map<string, number>()
    const kept: NonNullable<AiAnalysisOutput['metrics']> = []
    for (const metric of accepted.metrics) {
      metric.confidence = capExtractionConfidence(metric.confidence)

      const norm = normalizeMetricType(metric.metricType, metric.label)
      if (norm.changed) {
        adjustedMetrics.push({
          id: metric.id ?? null,
          label: metric.label,
          originalType: metric.metricType,
          normalizedType: norm.metricType,
          reason: norm.reason,
        })
        metric.metricType = norm.metricType
      }

      if (!Number.isFinite(metric.value)) {
        warnings.push({
          message: `La cifra "${metric.label}" no tiene un valor numérico válido y se omitió.`,
          code: 'metric_invalid_value',
          path: 'metrics',
        })
        requiresReview = true
        continue
      }

      // La cifra debe existir en el corpus permitido (anti-invención).
      const numericPresent =
        valueAppearsInCorpus(metric.value, fullCorpus) ||
        metric.evidence.some((e) => excerptExistsInCorpus(e.field, e.excerpt, corpus))
      if (!numericPresent) {
        warnings.push({
          message: `La cifra "${metric.label}" (${metric.value}) no se encontró en el texto disponible; se marcó como no verificada.`,
          code: 'metric_not_in_corpus',
          path: 'metrics',
        })
        metric.epistemicStatus = 'uncertain'
        metric.confidence = Math.min(metric.confidence, 0.35)
        requiresReview = true
      }

      // Duplicación de la misma métrica (mismo tipo + mismo periodo/corte).
      const key = `${metric.metricType}|${metric.cutoffDate ?? ''}|${metric.periodEnd ?? ''}`
      if (seen.has(key) && seen.get(key) !== metric.value) {
        warnings.push({
          message: `Se reportan valores distintos para "${metric.label}" en el mismo periodo; se conservan ambos para revisión.`,
          code: 'metric_conflicting_values',
          path: 'metrics',
        })
        requiresReview = true
      } else {
        seen.set(key, metric.value)
      }

      kept.push(metric)
    }
    accepted.metrics = kept

    // Limitación del corpus: si hay métricas pero el extracto es corto, advertir.
    const excerptLen = (content.permittedExcerpt ?? '').length + (content.description ?? '').length
    if (kept.length > 0 && excerptLen < 900) {
      const already = (accepted.unknowns ?? []).some((u) =>
        /corpus permitido|cuerpo completo|informe original/i.test(u.description),
      )
      if (!already) {
        accepted.unknowns = [
          ...(accepted.unknowns ?? []),
          {
            category: 'corpus_limitation',
            description:
              'El corpus permitido no incluye el cuerpo completo del informe original; pueden faltar cifras, desgloses territoriales o actualizaciones posteriores al corte.',
          },
        ]
      }
    }

    // Cifra en afirmación pero ausente en métricas (para noticias con balance).
    const metricValues = new Set(kept.map((m) => m.value))
    for (const claim of accepted.claims) {
      const nums = extractNumbersFromText(claim.statement)
      for (const n of nums) {
        if (n >= 100 && !metricValues.has(n) && !hasCloseMetric(n, metricValues)) {
          warnings.push({
            message: `La cifra ${n.toLocaleString('es-GT')} aparece en una afirmación pero no está registrada como métrica estructurada.`,
            code: 'claim_number_without_metric',
            path: 'claims',
          })
          break
        }
      }
    }
  }

  for (const flag of accepted.sensitivityFlags) {
    const code = typeof flag === 'string' ? flag : flag.code
    if (SENSITIVE_AUTO_REVIEW.has(code)) {
      requiresReview = true
    }
  }

  if (
    accepted.eventCandidate.qualifies &&
    accepted.eventCandidate.promotionRecommendation === 'ready_for_grouping'
  ) {
    requiresReview = true
    warnings.push({
      code: 'event_promotion_review',
      message: 'Candidato a evento listo para agrupación — requiere revisión humana en N2',
    })
  }

  // Cobertura documental + fuente primaria recomendada (determinístico si el modelo omite).
  const coverage = inferDocumentCoverage(content, accepted)
  accepted.documentCoverage = coverage.coverage
  if (!accepted.recommendedPrimarySource && coverage.recommended) {
    accepted.recommendedPrimarySource = coverage.recommended
  }

  accepted.requiresHumanReview = requiresReview

  const valid = errors.length === 0

  return {
    valid,
    warnings,
    errors,
    rejectedClaims,
    adjustedClaims,
    rejectedRelations,
    adjustedMetrics,
    requiresReview,
    acceptedOutput: accepted,
  }
}

/** Evalúa si el corpus permitido basta para un análisis profundo. */
export function inferDocumentCoverage(
  content: PermittedDocumentContent,
  output: AiAnalysisOutput,
): {
  coverage: NonNullable<AiAnalysisOutput['documentCoverage']>
  recommended: NonNullable<AiAnalysisOutput['recommendedPrimarySource']> | null
} {
  const excerptLen = (content.permittedExcerpt ?? '').length + (content.description ?? '').length
  const hasMetrics = (output.metrics?.length ?? 0) > 0
  const institutional = /conred|insivumeh|ministerio|mspas|provial|pnc|igss|oms|ops/i.test(
    `${content.title} ${content.description ?? ''} ${content.permittedExcerpt ?? ''}`,
  )
  const judicial = /jueza|falta de m[eé]rito|resoluci[oó]n|fiscal|tribunal/i.test(
    `${content.title} ${content.description ?? ''}`,
  )
  const health = /salud|sarampi[oó]n|casos|epidem|hospital|virus|enfermedad/i.test(
    `${content.title} ${content.description ?? ''}`,
  )
  const road = /kil[oó]metro|ruta|carretera|provial|accidente|choque|vuelco/i.test(
    `${content.title} ${content.description ?? ''}`,
  )

  let level: 'sufficient' | 'partial' | 'insufficient' = 'partial'
  let label = 'Parcial'
  let reason =
    'El análisis se basa en metadatos y extracto breve; puede faltar detalle del artículo completo.'

  if (excerptLen >= 1200 && (output.claims?.length ?? 0) >= 3) {
    level = 'sufficient'
    label = 'Suficiente para análisis'
    reason = 'El corpus permitido contiene hechos estructurables suficientes para este documento.'
  } else if (excerptLen < 280 || (output.claims?.length ?? 0) === 0) {
    level = 'insufficient'
    label = 'Insuficiente para análisis profundo'
    reason = 'El extracto disponible es demasiado breve para construir inteligencia profunda.'
  }

  // Balances institucionales con pocas cifras → parcial aunque el texto base alcance.
  if (hasMetrics && institutional && excerptLen < 900) {
    level = 'partial'
    label = 'Parcial'
    reason =
      'El extracto periodístico resume cifras institucionales; falta el informe o boletín original.'
  }

  let recommended: NonNullable<AiAnalysisOutput['recommendedPrimarySource']> | null = null
  if (level !== 'sufficient') {
    if (institutional && hasMetrics) {
      recommended = {
        sourceType: 'Informe o actualización oficial institucional',
        reason: 'El extracto periodístico contiene un resumen parcial de las cifras.',
        fieldsItWouldComplete: [
          'desglose territorial',
          'cifras adicionales',
          'fecha de corte confirmada',
          'metodología del conteo',
        ],
      }
    } else if (judicial) {
      recommended = {
        sourceType: 'Resolución o boleta judicial',
        reason: 'La noticia resume un acto procesal; el documento oficial completaría nombres, fechas y fundamentos.',
        fieldsItWouldComplete: ['identidad de autoridades', 'fundamento', 'fecha exacta', 'estado del proceso'],
      }
    } else if (health) {
      recommended = {
        sourceType: 'Boletín epidemiológico o comunicado sanitario',
        reason: 'Las cifras sanitarias requieren la fuente primaria para confirmar territorio y periodo.',
        fieldsItWouldComplete: ['casos por territorio', 'periodo de corte', 'definiciones de caso', 'fallecimientos'],
      }
    } else if (road) {
      recommended = {
        sourceType: 'Reporte vial o comunicado de Provial / bomberos',
        reason: 'El extracto resume el incidente; el reporte operativo detallaría cierre, kilómetro y duración.',
        fieldsItWouldComplete: ['kilómetro exacto', 'estado del cierre', 'duración', 'rutas alternas'],
      }
    } else {
      recommended = {
        sourceType: 'Comunicado o fuente primaria oficial',
        reason: 'El corpus periodístico es limitado para completar hechos y corroboración.',
        fieldsItWouldComplete: ['detalle factual', 'cifras', 'ubicaciones', 'atribución oficial'],
      }
    }
  }

  return {
    coverage: { level, label, reason },
    recommended,
  }
}

export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4)
}

export interface CostEstimate {
  inputTokens: number
  outputTokens: number
  estimatedCostUsd: number
  modelName: string
  provider: string
}

const MODEL_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  'gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10 },
}

export function estimateAnalysisCost(
  inputText: string,
  modelName: string,
  passes: 1 | 2 = 2,
): CostEstimate {
  const pricing = MODEL_PRICING[modelName] ?? MODEL_PRICING['gpt-4o-mini']!
  const inputTokens = estimateTokenCount(inputText) * passes + (passes === 2 ? 400 : 0)
  const outputTokens = passes === 2 ? 2800 : 1200
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * pricing.inputPer1M +
    (outputTokens / 1_000_000) * pricing.outputPer1M

  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
    modelName,
    provider: 'openai',
  }
}
