// Tipos primitivos compartidos por toda la Ontology

export type EntityId = string

export type ISODateTime = string

export interface GeoLocation {
  type: 'point' | 'polygon' | 'region' | 'country'
  coordinates?: [longitude: number, latitude: number]
  regionName?: string
  departmentCode?: string
  countryCode: string
}

export interface GeoGeometry {
  type: 'Point' | 'Polygon' | 'MultiPolygon'
  coordinates: number[] | number[][] | number[][][]
}

export type ConfidenceScore = number // 0-100

export type SeverityLevel = 'leve' | 'moderada' | 'significativa' | 'critica'

export type PriorityLevel = 'baja' | 'media' | 'alta' | 'critica'

export type RiskLevel = 'bajo' | 'medio' | 'alto' | 'critico'

export type TimeHorizon = 'inmediato' | 'corto_plazo' | 'mediano_plazo' | 'largo_plazo'

export type VariableCategory =
  | 'vegetacion'
  | 'clima'
  | 'hidrologia'
  | 'incendio'
  | 'suelo'
  | 'institucional'
  | 'socioambiental'
  | 'agricola'

export type HallazgoCategory =
  | 'climatico'
  | 'hidrologico'
  | 'vegetacion'
  | 'incendio'
  | 'suelo'
  | 'institucional'
  | 'compuesto'
