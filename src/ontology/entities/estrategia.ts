import type {
  ConfidenceScore,
  EntityId,
  ISODateTime,
  PriorityLevel,
  TimeHorizon,
} from '../primitives'

export type EstrategiaStatus =
  | 'propuesta'
  | 'aceptada'
  | 'en_ejecucion'
  | 'completada'
  | 'rechazada'

export interface Estrategia {
  id: EntityId
  hallazgoId: EntityId
  titulo: string
  descripcion: string
  acciones: string[]
  rationale: string
  confianza: ConfidenceScore
  prioridad: PriorityLevel
  horizonte: TimeHorizon
  responsableSugerido?: string
  estado: EstrategiaStatus
  generadaEn: ISODateTime
}
