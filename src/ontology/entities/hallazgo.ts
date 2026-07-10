import type {
  ConfidenceScore,
  EntityId,
  GeoLocation,
  HallazgoCategory,
  ISODateTime,
} from '../primitives'

export type HallazgoStatus =
  | 'detectado'
  | 'en_investigacion'
  | 'confirmado'
  | 'priorizado'
  | 'en_seguimiento'
  | 'resuelto'
  | 'descartado'

export interface Hallazgo {
  id: EntityId
  codigo: string
  titulo: string
  descripcion: string
  categoria: HallazgoCategory

  territorioId: EntityId
  ubicacion: GeoLocation
  detectadoEn: ISODateTime
  actualizadoEn: ISODateTime

  estado: HallazgoStatus
  prioridadId?: EntityId
  riesgoId?: EntityId

  eventoIds: EntityId[]
  hipotesisIds: EntityId[]
  evidenciaIds: EntityId[]
  estrategiaIds: EntityId[]
  expedienteId: EntityId

  confianza: ConfidenceScore
  observacionCount: number
  eventoCount: number

  version: number
  versionMotor: string
}
