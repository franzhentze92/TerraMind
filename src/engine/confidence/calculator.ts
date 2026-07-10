import type { ConfidenceInput, ConfidenceResult, ConfidenceFactor, ConfidenceCalculator } from './types'
import {
  CONFIDENCE_WEIGHTS,
  scoreToLevel,
  buildExplanation,
} from './types'

function scoreFuentesIndependientes(count: number): number {
  if (count >= 4) return CONFIDENCE_WEIGHTS.fuentes_independientes
  if (count >= 3) return 20
  if (count >= 2) return 15
  return 0
}

function scoreCoherenciaTemporal(dias: number): number {
  if (dias <= 7) return CONFIDENCE_WEIGHTS.coherencia_temporal
  if (dias <= 14) return 12
  if (dias <= 30) return 8
  return 3
}

function scoreCoherenciaEspacial(
  nivel: ConfidenceInput['coherenciaEspacial'],
): number {
  const scores: Record<ConfidenceInput['coherenciaEspacial'], number> = {
    mismo: CONFIDENCE_WEIGHTS.coherencia_espacial,
    adyacente: 7,
    departamento: 5,
    diferente: 2,
  }
  return scores[nivel]
}

function scoreRatioEvidencia(aFavor: number, enContra: number): number {
  const total = aFavor + enContra
  if (total === 0) return 0
  const ratio = aFavor / total
  if (ratio >= 0.9) return CONFIDENCE_WEIGHTS.ratio_evidencia
  if (ratio >= 0.75) return 20
  if (ratio >= 0.6) return 15
  if (ratio >= 0.5) return 8
  return 0
}

function scoreCalidad(promedio: number): number {
  return Math.round((promedio / 100) * CONFIDENCE_WEIGHTS.calidad_observaciones)
}

function scoreCorroboracion(
  estado: ConfidenceInput['hipotesisEstado'],
  confianza: number,
): number {
  if (estado === 'confirmada') return CONFIDENCE_WEIGHTS.corroboracion_hipotesis
  if (estado === 'activa' && confianza >= 70) return 12
  if (estado === 'activa' && confianza >= 50) return 8
  if (estado === 'propuesta') return 4
  return 0
}

export class DeterministicConfidenceCalculator implements ConfidenceCalculator {
  calculate(input: ConfidenceInput): ConfidenceResult {
    const factores: ConfidenceFactor[] = [
      {
        id: 'fuentes_independientes',
        nombre: 'Fuentes independientes',
        score: scoreFuentesIndependientes(input.fuentesIndependientes),
        maxScore: CONFIDENCE_WEIGHTS.fuentes_independientes,
        peso: CONFIDENCE_WEIGHTS.fuentes_independientes,
        detalle:
          input.fuentesIndependientes >= 2
            ? `${input.fuentesIndependientes} fuentes corroboran`
            : 'Fuentes insuficientes',
        icono: input.fuentesIndependientes >= 2 ? 'check' : 'cross',
      },
      {
        id: 'coherencia_temporal',
        nombre: 'Coherencia temporal',
        score: scoreCoherenciaTemporal(input.ventanaTemporalDias),
        maxScore: CONFIDENCE_WEIGHTS.coherencia_temporal,
        peso: CONFIDENCE_WEIGHTS.coherencia_temporal,
        detalle:
          input.ventanaTemporalDias <= 30
            ? `Datos en ventana de ${input.ventanaTemporalDias} días`
            : 'Datos de períodos no comparables',
        icono: input.ventanaTemporalDias <= 30 ? 'check' : 'warning',
      },
      {
        id: 'coherencia_espacial',
        nombre: 'Coherencia espacial',
        score: scoreCoherenciaEspacial(input.coherenciaEspacial),
        maxScore: CONFIDENCE_WEIGHTS.coherencia_espacial,
        peso: CONFIDENCE_WEIGHTS.coherencia_espacial,
        detalle:
          input.coherenciaEspacial === 'mismo'
            ? 'Mismo territorio'
            : `Coherencia espacial: ${input.coherenciaEspacial}`,
        icono: input.coherenciaEspacial === 'mismo' ? 'check' : 'warning',
      },
      {
        id: 'ratio_evidencia',
        nombre: 'Ratio de evidencia',
        score: scoreRatioEvidencia(input.evidenciaAFavor, input.evidenciaEnContra),
        maxScore: CONFIDENCE_WEIGHTS.ratio_evidencia,
        peso: CONFIDENCE_WEIGHTS.ratio_evidencia,
        detalle:
          input.evidenciaEnContra === 0
            ? `${input.evidenciaAFavor} a favor, sin evidencia contradictoria`
            : `${input.evidenciaAFavor} a favor, ${input.evidenciaEnContra} en contra`,
        icono: input.evidenciaEnContra === 0 ? 'check' : 'warning',
      },
      {
        id: 'calidad_observaciones',
        nombre: 'Calidad de observaciones',
        score: scoreCalidad(input.calidadPromedio),
        maxScore: CONFIDENCE_WEIGHTS.calidad_observaciones,
        peso: CONFIDENCE_WEIGHTS.calidad_observaciones,
        detalle: `Calidad promedio: ${input.calidadPromedio}%`,
        icono: input.calidadPromedio >= 70 ? 'check' : 'warning',
      },
      {
        id: 'corroboracion_hipotesis',
        nombre: 'Corroboración de hipótesis',
        score: scoreCorroboracion(input.hipotesisEstado, input.hipotesisConfianza),
        maxScore: CONFIDENCE_WEIGHTS.corroboracion_hipotesis,
        peso: CONFIDENCE_WEIGHTS.corroboracion_hipotesis,
        detalle: `Hipótesis ${input.hipotesisEstado}`,
        icono: input.hipotesisEstado === 'confirmada' ? 'check' : 'warning',
      },
    ]

    let score = factores.reduce((sum, f) => sum + f.score, 0)

    // Caps del Analyst Manual
    if (input.evidenciaEnContra > 0 && input.evidenciaAFavor / (input.evidenciaAFavor + input.evidenciaEnContra) < 0.6) {
      score = Math.min(score, 59)
    }
    if (input.fuentesIndependientes < 2) {
      score = Math.min(score, 40)
    }

    const nivel = scoreToLevel(score)
    const explicacion = buildExplanation(factores, score)

    return {
      score,
      nivel,
      factores,
      explicacion,
      explicacionCorta: explicacion,
    }
  }
}

export const confidenceCalculator: ConfidenceCalculator =
  new DeterministicConfidenceCalculator()
