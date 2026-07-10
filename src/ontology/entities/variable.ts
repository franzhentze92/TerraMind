import type { VariableCategory } from '../primitives'
import type { EntityId } from '../primitives'

export type ValueType = 'numerico' | 'categorico' | 'booleano'

export type BaselineMethod =
  | 'media_movil_30d'
  | 'percentil_historico'
  | 'estacional'

export type PreferredDirection = 'alto' | 'bajo' | 'estable' | 'neutral'

export interface Variable {
  id: EntityId
  nombre: string
  nombreCorto: string
  categoria: VariableCategory

  fuenteId: EntityId
  fuenteAlternativas?: EntityId[]

  unidad: string
  tipoValor: ValueType
  resolucionEspacial: string
  resolucionTemporal: string
  frecuenciaActualizacion: string

  rangoNormal: { min: number; max: number }
  interpretacion: string
  direccionPreferida: PreferredDirection

  variablesRelacionadas: EntityId[]
  usadaEnReglas: EntityId[]
  categoriasHallazgo: string[]

  umbralAlerta?: number
  umbralCritico?: number
  metodoBaseline: BaselineMethod

  activa: boolean
  version: string
}

export interface Fuente {
  id: EntityId
  nombre: string
  tipo: string
  variables: EntityId[]
  territorios: EntityId[]
  frecuenciaIngesta: string
  activa: boolean
}
