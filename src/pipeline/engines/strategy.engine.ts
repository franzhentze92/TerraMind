import type { Estrategia } from '@/ontology/entities/estrategia'
import type { Hallazgo } from '@/ontology/entities/hallazgo'
import type { Prioridad } from '@/ontology/entities/prioridad'
import { STRATEGY_LIBRARY } from '@/engine/libraries/strategy.library'

/**
 * Strategy Engine — selecciona estrategia de la biblioteca según confianza y prioridad.
 */
export function selectStrategy(
  hallazgo: Hallazgo,
  prioridad: Prioridad,
  hipotesisId: string,
): Estrategia {
  const candidates = STRATEGY_LIBRARY.filter(
    (s) =>
      s.hipotesisId === hipotesisId &&
      s.activa &&
      hallazgo.confianza >= s.minConfianza &&
      priorityRank(prioridad.nivel) >= priorityRank(s.minPrioridad),
  )

  const fallback = STRATEGY_LIBRARY.find(
    (s) => s.hipotesisId === hipotesisId && s.activa && s.nivel === 'conservadora',
  )

  const template =
    candidates.find((s) => s.nivel === 'intensiva') ??
    candidates.find((s) => s.nivel === 'balanceada') ??
    candidates[0] ??
    fallback

  const now = new Date().toISOString()

  return {
    id: `str:${hallazgo.codigo}`,
    hallazgoId: hallazgo.id,
    titulo: template?.objetivo ?? 'Monitorear situación',
    descripcion: template?.objetivo ?? '',
    acciones: template?.acciones ?? ['Monitorear evolución'],
    rationale: `Estrategia ${template?.nivel ?? 'conservadora'} seleccionada por motor determinístico`,
    confianza: hallazgo.confianza,
    prioridad: prioridad.nivel,
    horizonte: template?.horizonte ?? 'inmediato',
    responsableSugerido: template?.responsableSugerido,
    estado: 'propuesta',
    generadaEn: now,
  }
}

function priorityRank(level: string): number {
  const ranks: Record<string, number> = {
    baja: 1,
    media: 2,
    alta: 3,
    critica: 4,
  }
  return ranks[level] ?? 0
}
