/**
 * TerraMind Engine — El cerebro
 *
 * Documentación: docs/BRAIN-SPEC.md
 *
 * Propiedad intelectual fundacional:
 * - Reasoning Framework (12 etapas modulares)
 * - Evidence Graph (trazabilidad total)
 * - Confidence System (explicable)
 * - Hypothesis Library (conocimiento experto)
 * - Strategy Library (conocimiento experto)
 * - Knowledge Packs (dominios estructurados)
 */

// Reasoning Engine
export type {
  ReasoningStageId,
  ReasoningMode,
  ReasoningContext,
  ReasoningStage,
  ReasoningResult,
  ReasoningOrchestrator,
  StageResult,
  StageMetadata,
  ValidationResult,
} from './reasoning/types'
export { REASONING_STAGE_ORDER, STAGE_METADATA } from './reasoning/types'

export type {
  ObserveInput,
  ObserveOutput,
  ValidateInput,
  ValidateOutput,
  CorrelateInput,
  CorrelateOutput,
  HallazgoCandidate,
  CoverageReport,
  ContradictionReport,
  Escenario,
  NarrateInput,
  NarrateOutput,
} from './reasoning/stage-io'

// Evidence Graph
export type {
  GraphNode,
  GraphEdge,
  GraphNodeType,
  GraphRelation,
  GraphPath,
  TracedNode,
  ConclusionTrace,
  EvidenceGraph,
} from './evidence-graph/types'
export { createNodeId } from './evidence-graph/types'

// Confidence System
export type {
  ConfidenceLevel,
  ConfidenceFactor,
  ConfidenceResult,
  ConfidenceInput,
  ConfidenceCalculator,
} from './confidence/types'
export {
  CONFIDENCE_WEIGHTS,
  CONFIDENCE_THRESHOLDS,
  scoreToLevel,
  buildExplanation,
} from './confidence/types'
export {
  DeterministicConfidenceCalculator,
  confidenceCalculator,
} from './confidence/calculator'

// Libraries
export type {
  HypothesisTemplate,
  HypothesisCondition,
} from './libraries/hypothesis.library'
export {
  HYPOTHESIS_LIBRARY,
  getHypothesisById,
  getActiveHypotheses,
  getFallbackHypothesis,
} from './libraries/hypothesis.library'

export type {
  StrategyTemplate,
  StrategyLevel,
  TrackingIndicator,
} from './libraries/strategy.library'
export {
  STRATEGY_LIBRARY,
  getStrategiesForHypothesis,
  getStrategyByLevel,
} from './libraries/strategy.library'

// Knowledge Packs
export type {
  KnowledgePack,
  KnowledgeEntity,
  KnowledgeRelation,
  FenologiaPhase,
} from './knowledge-pack/types'
export {
  AGRICULTURE_PACK_GT,
  KNOWLEDGE_PACKS,
  getKnowledgePack,
} from './knowledge-pack/types'
