import type { EntityId } from '@/ontology/primitives'
import type { Observacion } from '@/ontology/entities/observacion'

// ── Stage Inputs/Outputs ──

export interface ObserveInput {
  territorioId: EntityId
  ventana: { inicio: string; fin: string }
  fuenteIds?: EntityId[]
}

export interface ObserveOutput {
  observaciones: Observacion[]
  fuentesActivas: number
  totalRecibidas: number
}

export interface RejectedObservation {
  observacion: Observacion
  razon: string
  criterio: string
}

export interface CoverageReport {
  fuentesEsperadas: number
  fuentesActivas: number
  fuentesFaltantes: EntityId[]
  razon?: string
  impactoEnConfianza: string
}

export interface ValidateInput {
  observaciones: Observacion[]
}

export interface ValidateOutput {
  validas: Observacion[]
  rechazadas: RejectedObservation[]
  cobertura: CoverageReport
}

export interface HallazgoCandidate {
  titulo: string
  categoria: string
  eventoIds: EntityId[]
  reglaId: EntityId
  territorioId: EntityId
}

export interface CorrelateInput {
  observaciones: Observacion[]
  territorioId: EntityId
}

export interface CorrelateOutput {
  eventoIds: EntityId[]
  hallazgosCandidatos: HallazgoCandidate[]
}

export interface ContradictionReport {
  hipotesisId: EntityId
  ratioAFavor: number
  ratioEnContra: number
  resuelta: boolean
  accion: 'investigar' | 'descartar' | 'reevaluar'
}

export interface Escenario {
  id: EntityId
  tipo: 'continuacion' | 'escalacion' | 'recuperacion' | 'punto_inflexion'
  descripcion: string
  horizonte: string
  confianza: number
  variablesProyectadas: Record<string, string>
}

export interface ScenarioInput {
  hallazgoId: EntityId
  hipotesisPrincipalId: EntityId
}

export interface ScenarioOutput {
  escenarios: Escenario[]
}

export interface NarrateInput {
  hallazgoId: EntityId
  expedienteId: EntityId
  reporteId?: EntityId
}

export interface NarrateOutput {
  resumenEjecutivo: string
  generadoPor: 'ai' | 'template'
}
