import type { EntityId } from '../primitives'

export type RuleCategory =
  | 'deteccion'
  | 'correlacion'
  | 'hipotesis'
  | 'prioridad'
  | 'estrategia'
  | 'inhibicion'

export type ConditionOperator =
  | '>'
  | '<'
  | '>='
  | '<='
  | '=='
  | '!='
  | 'cambio_%'
  | 'cambio_abs'
  | 'dentro_rango'
  | 'fuera_rango'
  | 'existe'
  | 'no_existe'

export type CompareWith = 'baseline' | 'historico' | 'vecinos'

export interface RuleCondition {
  variableId?: EntityId
  eventoTipo?: string
  operador: ConditionOperator
  valor?: number | string
  ventana?: string
  territorioId?: EntityId
  compararCon?: CompareWith
}

export type RuleActionType =
  | 'crear_evento'
  | 'crear_hallazgo'
  | 'crear_hipotesis'
  | 'asignar_prioridad'
  | 'crear_estrategia'
  | 'inhibir'
  | 'solicitar_datos'
  | 'programar_reevaluacion'

export interface RuleAction {
  tipo: RuleActionType
  parametros: Record<string, unknown>
}

export interface Regla {
  id: EntityId
  nombre: string
  version: string
  categoria: RuleCategory
  activa: boolean
  prioridad: number

  condiciones: RuleCondition[]
  excepciones?: RuleCondition[]
  accion: RuleAction

  territorioIds?: EntityId[]
  variablesInvolucradas: EntityId[]
  descripcion: string
}

export interface RuleEvaluationContext {
  territorioId: EntityId
  observaciones: EntityId[]
  eventos: EntityId[]
  hallazgos: EntityId[]
  ventana: { inicio: string; fin: string }
}

export interface RuleEvaluationResult {
  reglaId: EntityId
  cumplida: boolean
  inhibida: boolean
  accion?: RuleAction
  razon?: string
}

/**
 * Pipeline de evaluación de reglas.
 * Diseño conceptual — la implementación vive en el Reasoning Engine.
 */
export interface RuleEnginePipeline {
  etapas: RuleCategory[]
  ordenEvaluacion: RuleCategory[]
}

export const RULE_ENGINE_PIPELINE: RuleEnginePipeline = {
  etapas: ['inhibicion', 'deteccion', 'correlacion', 'hipotesis', 'prioridad', 'estrategia'],
  ordenEvaluacion: ['inhibicion', 'deteccion', 'correlacion', 'hipotesis', 'prioridad', 'estrategia'],
}

export interface ReasoningPipeline {
  nombre: string
  etapas: {
    id: string
    modulo: string
    input: string
    output: string
  }[]
}

export const REASONING_PIPELINE: ReasoningPipeline = {
  nombre: 'TerraMind Reasoning Pipeline',
  etapas: [
    { id: 'ingest', modulo: 'DataEngine', input: 'API externa', output: 'Observacion[]' },
    { id: 'detect', modulo: 'EventDetector', input: 'Observacion[]', output: 'Evento[]' },
    { id: 'correlate', modulo: 'HallazgoEngine', input: 'Evento[]', output: 'Hallazgo + Expediente' },
    { id: 'hypothesize', modulo: 'HypothesisGenerator', input: 'Hallazgo', output: 'Hipotesis[]' },
    { id: 'evidence', modulo: 'EvidenceAggregator', input: 'Hipotesis + Observacion[]', output: 'Evidencia[]' },
    { id: 'risk', modulo: 'RiskEngine', input: 'Hallazgo', output: 'Riesgo' },
    { id: 'prioritize', modulo: 'PriorityEngine', input: 'Hallazgo + Riesgo', output: 'Prioridad' },
    { id: 'strategize', modulo: 'StrategyEngine', input: 'Hallazgo + Prioridad', output: 'Estrategia[]' },
    { id: 'report', modulo: 'ReportGenerator', input: 'Hallazgo[]', output: 'Reporte' },
    { id: 'narrate', modulo: 'AILayer', input: 'Hallazgo + Expediente', output: 'Texto ejecutivo' },
  ],
}
