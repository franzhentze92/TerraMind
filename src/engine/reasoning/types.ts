import type { EntityId, ISODateTime } from '@/ontology/primitives'
import type { EvidenceGraph } from '../evidence-graph/types'

export type ReasoningStageId =
  | 'observe'
  | 'validate'
  | 'correlate'
  | 'hypothesize'
  | 'evidence-for'
  | 'evidence-against'
  | 'confidence'
  | 'prioritize'
  | 'scenarios'
  | 'strategize'
  | 'report'
  | 'narrate'

export type ReasoningMode = 'full' | 'incremental' | 'reevaluation' | 'single_hallazgo'

export interface ReasoningContext {
  territorioId: EntityId
  ventana: { inicio: ISODateTime; fin: ISODateTime }
  graph: EvidenceGraph
  mode: ReasoningMode
  knowledgePackIds: EntityId[]
  startFromStage?: ReasoningStageId
  hallazgoId?: EntityId
}

export interface StageMetadata {
  durationMs: number
  entitiesProcessed: number
  warnings: string[]
  stageId: ReasoningStageId
  completedAt: ISODateTime
}

export interface StageResult<TOutput> {
  output: TOutput
  metadata: StageMetadata
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Contrato que toda etapa del Reasoning Engine implementa.
 * Cada etapa es independiente, reemplazable y testeable.
 */
export interface ReasoningStage<TInput, TOutput> {
  readonly id: ReasoningStageId
  readonly name: string
  readonly version: string
  readonly usesAI: boolean

  execute(input: TInput, context: ReasoningContext): Promise<StageResult<TOutput>>
  validate(input: TInput): ValidationResult
}

export interface ReasoningResult {
  context: ReasoningContext
  stages: StageResult<unknown>[]
  hallazgos: EntityId[]
  reporteId?: EntityId
  completedAt: ISODateTime
  success: boolean
  errors: string[]
}

export interface ReasoningOrchestrator {
  run(context: ReasoningContext): Promise<ReasoningResult>
  runStage<TInput, TOutput>(
    stage: ReasoningStage<TInput, TOutput>,
    input: TInput,
    context: ReasoningContext,
  ): Promise<StageResult<TOutput>>
}

export const REASONING_STAGE_ORDER: ReasoningStageId[] = [
  'observe',
  'validate',
  'correlate',
  'hypothesize',
  'evidence-for',
  'evidence-against',
  'confidence',
  'prioritize',
  'scenarios',
  'strategize',
  'report',
  'narrate',
]

export const STAGE_METADATA: Record<
  ReasoningStageId,
  { name: string; module: string; usesAI: boolean }
> = {
  observe: { name: 'Observar', module: 'ObserveStage', usesAI: false },
  validate: { name: 'Validar', module: 'ValidateStage', usesAI: false },
  correlate: { name: 'Correlacionar', module: 'CorrelateStage', usesAI: false },
  hypothesize: { name: 'Generar Hipótesis', module: 'HypothesizeStage', usesAI: false },
  'evidence-for': { name: 'Evidencia a Favor', module: 'EvidenceForStage', usesAI: false },
  'evidence-against': { name: 'Evidencia en Contra', module: 'EvidenceAgainstStage', usesAI: false },
  confidence: { name: 'Calcular Confianza', module: 'ConfidenceStage', usesAI: false },
  prioritize: { name: 'Priorizar', module: 'PrioritizeStage', usesAI: false },
  scenarios: { name: 'Generar Escenarios', module: 'ScenarioStage', usesAI: false },
  strategize: { name: 'Proponer Estrategias', module: 'StrategizeStage', usesAI: false },
  report: { name: 'Generar Reporte', module: 'ReportStage', usesAI: false },
  narrate: { name: 'Narrar', module: 'NarrateStage', usesAI: true },
}
