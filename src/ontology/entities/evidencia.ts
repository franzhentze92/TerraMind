import type { ConfidenceScore, EntityId, ISODateTime } from '../primitives'

export type EvidenciaTipo = 'a_favor' | 'en_contra' | 'neutral'
export type EvidenciaGeneradaPor = 'motor' | 'analista' | 'regla'

export interface Evidencia {
  id: EntityId
  tipo: EvidenciaTipo
  hallazgoId: EntityId
  hipotesisId?: EntityId

  observacionIds: EntityId[]
  eventoIds: EntityId[]
  fuenteIds: EntityId[]
  variableIds: EntityId[]

  resumen: string
  peso: number // 0-100
  confianza: ConfidenceScore

  generadaEn: ISODateTime
  generadaPor: EvidenciaGeneradaPor
}
