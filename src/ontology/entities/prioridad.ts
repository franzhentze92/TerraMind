import type { EntityId, ISODateTime, PriorityLevel } from '../primitives'

export interface Prioridad {
  id: EntityId
  hallazgoId: EntityId
  nivel: PriorityLevel
  score: number // 0-100
  razon: string
  asignadaEn: ISODateTime
  asignadaPor: 'motor' | 'analista'
  revisarEn?: ISODateTime
}
