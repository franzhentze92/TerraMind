import type { ConfidenceScore, EntityId, ISODateTime } from '../primitives'

export type ReporteTipo = 'diario' | 'semanal' | 'mensual' | 'especial'

export interface ReportePeriodo {
  inicio: ISODateTime
  fin: ISODateTime
}

export interface ReporteRespuestas {
  queEstaPasando: EntityId[]
  porQue: EntityId[]
  quePuedePasar: EntityId[]
  queMereceAtencion: EntityId[]
  queEstrategias: EntityId[]
}

export interface Reporte {
  id: EntityId
  tipo: ReporteTipo
  territorioId: EntityId
  periodo: ReportePeriodo
  generadoEn: ISODateTime

  respuestas: ReporteRespuestas
  hallazgoIds: EntityId[]
  resumenEjecutivo?: string
  confianzaGlobal: ConfidenceScore
}
