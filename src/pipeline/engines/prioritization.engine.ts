import type { Hallazgo } from '@/ontology/entities/hallazgo'
import type { Prioridad } from '@/ontology/entities/prioridad'
import type { Riesgo } from '@/ontology/entities/riesgo'
import type { PriorityLevel, RiskLevel } from '@/ontology/primitives'

export interface PrioritizationResult {
  prioridad: Prioridad
  riesgo: Riesgo
}

function scoreToPriority(score: number): PriorityLevel {
  if (score >= 80) return 'critica'
  if (score >= 60) return 'alta'
  if (score >= 40) return 'media'
  return 'baja'
}

function scoreToRisk(score: number, clusterSize: number): RiskLevel {
  if (score >= 80 || clusterSize >= 5) return 'critico'
  if (score >= 60) return 'alto'
  if (score >= 40) return 'medio'
  return 'bajo'
}

/**
 * Prioritization Engine — asigna prioridad y riesgo de forma determinística.
 */
export function assignPriority(
  hallazgo: Hallazgo,
  clusterSize: number,
): PrioritizationResult {
  const now = new Date().toISOString()

  const score = Math.min(
    100,
    hallazgo.confianza * 0.5 +
      (clusterSize >= 5 ? 30 : clusterSize >= 3 ? 20 : 10) +
      (hallazgo.categoria === 'incendio' ? 15 : 0),
  )

  const nivel = scoreToPriority(score)
  const riesgoNivel = scoreToRisk(score, clusterSize)

  const prioridad: Prioridad = {
    id: `pri:${hallazgo.codigo}`,
    hallazgoId: hallazgo.id,
    nivel,
    score,
    razon:
      nivel === 'critica'
        ? 'Múltiples focos activos con alta potencia radiativa'
        : 'Cluster de focos de calor detectado por FIRMS',
    asignadaEn: now,
    asignadaPor: 'motor',
    revisarEn: new Date(Date.now() + 6 * 3_600_000).toISOString(),
  }

  const riesgo: Riesgo = {
    id: `rsk:${hallazgo.codigo}`,
    hallazgoId: hallazgo.id,
    nivel: riesgoNivel,
    impacto: {
      territorial: `${clusterSize} focos activos — riesgo de propagación`,
      ambiental: 'Pérdida potencial de cobertura forestal',
      institucional: 'Requiere coordinación CONRED',
    },
    horizonte: 'inmediato',
    evaluadoEn: now,
    evaluadoPor: 'motor',
  }

  return { prioridad, riesgo }
}
