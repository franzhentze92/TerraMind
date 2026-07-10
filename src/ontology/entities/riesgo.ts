import type { EntityId, ISODateTime, RiskLevel, TimeHorizon } from '../primitives'

export interface RiesgoImpacto {
  territorial: string
  poblacion?: number
  economico?: string
  ambiental?: string
  institucional?: string
}

export interface Riesgo {
  id: EntityId
  hallazgoId: EntityId
  nivel: RiskLevel
  impacto: RiesgoImpacto
  horizonte: TimeHorizon
  evaluadoEn: ISODateTime
  evaluadoPor: 'motor' | 'regla'
}
