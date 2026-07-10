import type { EntityId, GeoGeometry } from '../primitives'

export type TerritorioType =
  | 'pais'
  | 'departamento'
  | 'municipio'
  | 'cuenca'
  | 'corredor'
  | 'custom'

export interface Territorio {
  id: EntityId
  nombre: string
  tipo: TerritorioType
  codigo: string
  padreId?: EntityId
  geometria?: GeoGeometry
  timezone: string
  metadata?: {
    poblacion?: number
    areaKm2?: number
    sectoresPrioritarios?: string[]
  }
}
