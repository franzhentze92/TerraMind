/**
 * TerraMind Ontology — Modelo del mundo
 *
 * Documentación: docs/ONTOLOGY.md
 * PRD: docs/TERRAMIND-PRD.md
 * Reglas: docs/RULE-BOOK.md
 * Analista: docs/ANALYST-MANUAL.md
 * Variables: docs/VARIABLE-CATALOG.md
 */

// Primitivos
export type * from './primitives'

// Entidades
export type { Territorio, TerritorioType } from './entities/territorio'
export type { Variable, Fuente, ValueType, BaselineMethod, PreferredDirection } from './entities/variable'
export type { Observacion } from './entities/observacion'
export type { Evento, EventoStatus } from './entities/evento'
export type { Hallazgo, HallazgoStatus } from './entities/hallazgo'
export type { Hipotesis, HipotesisStatus } from './entities/hipotesis'
export type { Evidencia, EvidenciaTipo, EvidenciaGeneradaPor } from './entities/evidencia'
export type { Riesgo, RiesgoImpacto } from './entities/riesgo'
export type { Prioridad } from './entities/prioridad'
export type { Estrategia, EstrategiaStatus } from './entities/estrategia'
export type { Reporte, ReporteTipo, ReporteRespuestas } from './entities/reporte'
export type {
  Expediente,
  ExpedienteStatus,
  ExpedienteEvent,
  ExpedienteEventType,
  SolicitudDatos,
} from './entities/expediente'

// Relaciones y ciclos de vida
export type { EntityType, RelationType, OntologyRelation } from './relationships'
export { ONTOLOGY_RELATIONS, getRelationsFor, getRelatedEntities } from './relationships'
export {
  EVENTO_LIFECYCLE,
  HALLAZGO_LIFECYCLE,
  HIPOTESIS_LIFECYCLE,
  EXPEDIENTE_LIFECYCLE,
  ESTRATEGIA_LIFECYCLE,
  canTransition,
  getAvailableTransitions,
  generateHallazgoCodigo,
  generateObservacionId,
} from './lifecycles'

// Rule Engine
export type {
  Regla,
  RuleCategory,
  RuleCondition,
  RuleAction,
  RuleActionType,
  ConditionOperator,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleEnginePipeline,
  ReasoningPipeline,
} from './rule-engine/types'
export { RULE_ENGINE_PIPELINE, REASONING_PIPELINE } from './rule-engine/types'
export { SEED_RULES, getRulesByCategory, getActiveRules } from './rule-engine/rules.seed'

// Catálogo
export { SEED_VARIABLES, getVariableById, getVariablesByCategory } from './catalog/variables.seed'
