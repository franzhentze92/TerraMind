import type { EntityId, ISODateTime, SeverityLevel } from '../primitives'

export type EventoStatus = 'detectado' | 'correlacionando' | 'asociado' | 'descartado'

export interface Evento {
  id: EntityId
  tipo: string
  territorioId: EntityId
  detectadoEn: ISODateTime

  observacionIds: EntityId[]
  variableId: EntityId
  valorObservado: number
  valorEsperado?: number
  desviacion?: number

  severidad: SeverityLevel
  reglaId: EntityId
  estado: EventoStatus

  metadata?: Record<string, unknown>
}
