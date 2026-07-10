import type {
  EntityId,
  GeoGeometry,
  GeoLocation,
  ISODateTime,
} from '../primitives'

export interface Observacion {
  id: EntityId
  variableId: EntityId
  fuenteId: EntityId
  territorioId: EntityId
  timestamp: ISODateTime
  ingestedAt: ISODateTime

  valor: number | string | boolean
  unidad: string
  ubicacion: GeoLocation
  geometria?: GeoGeometry

  calidad: number // 0-100
  flags: string[]
  referenciaRaw: string
  metadata?: Record<string, unknown>
}
