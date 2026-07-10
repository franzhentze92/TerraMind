import type { ConfidenceScore, EntityId, ISODateTime } from '../primitives'

export type HipotesisStatus =
  | 'propuesta'
  | 'activa'
  | 'confirmada'
  | 'refutada'
  | 'descartada'

export interface Hipotesis {
  id: EntityId
  hallazgoId: EntityId
  afirmacion: string
  confianza: ConfidenceScore
  estado: HipotesisStatus

  evidenciaAFavor: EntityId[]
  evidenciaEnContra: EntityId[]
  reglaId?: EntityId

  generadaEn: ISODateTime
  evaluadaEn?: ISODateTime
  razonDescarte?: string
}
