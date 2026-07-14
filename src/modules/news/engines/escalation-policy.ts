/**
 * Política de escalamiento fast → deep para análisis documental N2.
 *
 * Mejora futura (NO implementada en el cierre N2):
 * La política no debe depender únicamente de que exista contenido sensible.
 * Debe ponderar también: complejidad relacional, calidad del resultado fast,
 * errores de validación, relevancia documental, candidatura a evento y
 * necesidad de precisión legal o sanitaria. “Sensible” por sí solo no siempre
 * obliga a usar el modelo profundo.
 */
import type { NewsDocumentAnalysisDto } from '../types/news-analysis-dto.types'

/** Condiciones para escalar de fast a deep (piloto N2). */
export function shouldEscalateToDeep(dto: NewsDocumentAnalysisDto): string[] {
  const reasons: string[] = []
  if (dto.status === 'failed' || !dto.validation_summary.valid) {
    reasons.push('salida inválida o fallida tras validación')
  }
  if (dto.sensitivity_flags.length > 0 || dto.requires_human_review) {
    const sensitive = dto.sensitivity_flags.some((f) =>
      /fatality|criminal|health|minor|violence|natural_disaster|missing/i.test(f.code),
    )
    if (sensitive) reasons.push('contenido sensible')
  }
  if (dto.relationships.length >= 4) reasons.push('relaciones complejas')
  if (dto.metrics.length >= 3) reasons.push('múltiples métricas')
  if (
    dto.event_candidate?.qualifies &&
    (dto.event_candidate.promotion_recommendation === 'ready_for_grouping' ||
      (dto.event_candidate.confidence ?? 0) >= 0.7)
  ) {
    reasons.push('candidato fuerte a evento')
  }
  if ((dto.extraction_confidence ?? 1) < 0.65) {
    reasons.push('confianza de extracción insuficiente')
  }
  if (dto.validation_summary.warning_count >= 3) {
    reasons.push('advertencias determinísticas relevantes')
  }
  if (dto.validation_summary.rejected_relation_count > 0) {
    reasons.push('relaciones rechazadas por semántica')
  }
  return reasons
}
