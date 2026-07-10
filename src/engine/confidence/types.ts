import type { ConfidenceScore } from '@/ontology/primitives'

export type ConfidenceLevel = 'alta' | 'media' | 'baja' | 'insuficiente'

export interface ConfidenceFactor {
  id: string
  nombre: string
  score: number
  maxScore: number
  peso: number
  detalle: string
  icono: 'check' | 'warning' | 'cross'
}

export interface ConfidenceResult {
  score: ConfidenceScore
  nivel: ConfidenceLevel
  factores: ConfidenceFactor[]
  explicacion: string
  explicacionCorta: string
}

export interface ConfidenceInput {
  fuentesIndependientes: number
  ventanaTemporalDias: number
  coherenciaEspacial: 'mismo' | 'adyacente' | 'departamento' | 'diferente'
  evidenciaAFavor: number
  evidenciaEnContra: number
  calidadPromedio: number
  hipotesisEstado: 'confirmada' | 'activa' | 'propuesta' | 'refutada'
  hipotesisConfianza: number
}

export const CONFIDENCE_WEIGHTS = {
  fuentes_independientes: 25,
  coherencia_temporal: 15,
  coherencia_espacial: 10,
  ratio_evidencia: 25,
  calidad_observaciones: 10,
  corroboracion_hipotesis: 15,
} as const

export const CONFIDENCE_THRESHOLDS = {
  alta: 85,
  media: 60,
  baja: 30,
} as const

export interface ConfidenceCalculator {
  calculate(input: ConfidenceInput): ConfidenceResult
}

export function scoreToLevel(score: ConfidenceScore): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.alta) return 'alta'
  if (score >= CONFIDENCE_THRESHOLDS.media) return 'media'
  if (score >= CONFIDENCE_THRESHOLDS.baja) return 'baja'
  return 'insuficiente'
}

export function buildExplanation(factores: ConfidenceFactor[], score: number): string {
  const positivos = factores
    .filter((f) => f.icono === 'check')
    .map((f) => f.detalle)

  if (positivos.length === 0) {
    return `Confianza ${score}% — evidencia insuficiente para conclusiones definitivas.`
  }

  return `Confianza ${score}% porque ${positivos.join(', ')}.`
}
