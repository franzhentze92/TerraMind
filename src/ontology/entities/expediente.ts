import type { ConfidenceScore, EntityId, ISODateTime } from '../primitives'

export type ExpedienteStatus =
  | 'abierto'
  | 'en_investigacion'
  | 'pendiente_validacion'
  | 'cerrado'

export type ExpedienteEventType =
  | 'apertura'
  | 'evento_asociado'
  | 'hipotesis_generada'
  | 'hipotesis_confirmada'
  | 'hipotesis_refutada'
  | 'evidencia_agregada'
  | 'confianza_actualizada'
  | 'prioridad_asignada'
  | 'estrategia_generada'
  | 'estado_cambiado'
  | 'solicitud_datos'
  | 'cierre'

export interface ExpedienteEvent {
  id: EntityId
  tipo: ExpedienteEventType
  timestamp: ISODateTime
  descripcion: string
  metadata?: Record<string, unknown>
}

export interface SolicitudDatos {
  tipo: 'dato' | 'verificacion_campo' | 'fuente'
  descripcion: string
  razon: string
  solicitadoEn: ISODateTime
  estado: 'pendiente' | 'cumplida' | 'vencida'
}

/**
 * El Expediente es el verdadero producto de TerraMind.
 * Relación 1:1 con Hallazgo — se crea automáticamente al detectar un Hallazgo.
 */
export interface Expediente {
  id: EntityId
  hallazgoId: EntityId
  codigo: string

  estado: ExpedienteStatus
  aperturadoEn: ISODateTime
  cerradoEn?: ISODateTime

  observacionCount: number
  eventoCount: number
  hipotesisCount: number
  evidenciaAFavorCount: number
  evidenciaEnContraCount: number

  hipotesisPrincipalId?: EntityId
  confianzaActual: ConfidenceScore
  fuentesUtilizadas: EntityId[]

  proximaActualizacion: ISODateTime
  frecuenciaMonitoreo: string

  historial: ExpedienteEvent[]
  solicitudesPendientes: SolicitudDatos[]

  resumenEjecutivo?: string
}
