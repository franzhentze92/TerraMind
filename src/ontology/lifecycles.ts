import type { EntityId } from './primitives'
import type { EventoStatus } from './entities/evento'
import type { HallazgoStatus } from './entities/hallazgo'
import type { HipotesisStatus } from './entities/hipotesis'
import type { ExpedienteStatus } from './entities/expediente'
import type { EstrategiaStatus } from './entities/estrategia'

export interface LifecycleTransition<TStatus extends string> {
  from: TStatus
  to: TStatus
  trigger: string
  conditions?: string[]
}

export const EVENTO_LIFECYCLE: LifecycleTransition<EventoStatus>[] = [
  { from: 'detectado', to: 'correlacionando', trigger: 'rule_engine.correlate' },
  { from: 'correlacionando', to: 'asociado', trigger: 'hallazgo_engine.associate' },
  { from: 'correlacionando', to: 'descartado', trigger: 'rule_engine.discard', conditions: ['no_correlation_found'] },
  { from: 'detectado', to: 'descartado', trigger: 'rule_engine.inhibit', conditions: ['insufficient_evidence'] },
]

export const HALLAZGO_LIFECYCLE: LifecycleTransition<HallazgoStatus>[] = [
  { from: 'detectado', to: 'en_investigacion', trigger: 'hallazgo_engine.open_expediente' },
  { from: 'en_investigacion', to: 'confirmado', trigger: 'evidence_engine.confirm', conditions: ['confidence >= 85', 'sources >= 2', 'no_contradiction'] },
  { from: 'en_investigacion', to: 'descartado', trigger: 'analyst.discard', conditions: ['confidence < 30', 'hypothesis_refuted'] },
  { from: 'confirmado', to: 'priorizado', trigger: 'priority_engine.assign' },
  { from: 'priorizado', to: 'en_seguimiento', trigger: 'strategy_engine.activate' },
  { from: 'en_seguimiento', to: 'resuelto', trigger: 'analyst.resolve', conditions: ['situation_improved'] },
  { from: 'en_seguimiento', to: 'descartado', trigger: 'analyst.discard', conditions: ['false_positive'] },
]

export const HIPOTESIS_LIFECYCLE: LifecycleTransition<HipotesisStatus>[] = [
  { from: 'propuesta', to: 'activa', trigger: 'evidence_engine.evaluate', conditions: ['confidence >= 60'] },
  { from: 'activa', to: 'confirmada', trigger: 'evidence_engine.confirm', conditions: ['confidence >= 85', 'contradiction_ratio < 0.2'] },
  { from: 'activa', to: 'refutada', trigger: 'evidence_engine.refute', conditions: ['contradicting_evidence > supporting'] },
  { from: 'propuesta', to: 'descartada', trigger: 'analyst.discard' },
  { from: 'refutada', to: 'descartada', trigger: 'analyst.archive' },
]

export const EXPEDIENTE_LIFECYCLE: LifecycleTransition<ExpedienteStatus>[] = [
  { from: 'abierto', to: 'en_investigacion', trigger: 'hallazgo_engine.open' },
  { from: 'en_investigacion', to: 'pendiente_validacion', trigger: 'analyst.request_validation', conditions: ['confidence < 50 OR contradiction'] },
  { from: 'en_investigacion', to: 'cerrado', trigger: 'analyst.close', conditions: ['hallazgo_resuelto OR hallazgo_descartado'] },
  { from: 'pendiente_validacion', to: 'en_investigacion', trigger: 'data_engine.new_data' },
  { from: 'pendiente_validacion', to: 'cerrado', trigger: 'analyst.close' },
]

export const ESTRATEGIA_LIFECYCLE: LifecycleTransition<EstrategiaStatus>[] = [
  { from: 'propuesta', to: 'aceptada', trigger: 'user.accept' },
  { from: 'propuesta', to: 'rechazada', trigger: 'user.reject' },
  { from: 'aceptada', to: 'en_ejecucion', trigger: 'user.start' },
  { from: 'en_ejecucion', to: 'completada', trigger: 'user.complete' },
]

export function canTransition<TStatus extends string>(
  lifecycle: LifecycleTransition<TStatus>[],
  from: TStatus,
  to: TStatus,
): boolean {
  return lifecycle.some((t) => t.from === from && t.to === to)
}

export function getAvailableTransitions<TStatus extends string>(
  lifecycle: LifecycleTransition<TStatus>[],
  current: TStatus,
): LifecycleTransition<TStatus>[] {
  return lifecycle.filter((t) => t.from === current)
}

export function generateHallazgoCodigo(year: number, sequence: number): string {
  return `${year}-${sequence.toString().padStart(6, '0')}`
}

export function generateObservacionId(
  fuenteId: EntityId,
  timestamp: string,
  territorioId: EntityId,
  variableId: EntityId,
): string {
  return `obs:${fuenteId}:${territorioId}:${variableId}:${timestamp}`
}
