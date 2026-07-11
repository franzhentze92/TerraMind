/**
 * Canonical metric taxonomy for all of TerraMind.
 *
 * Product Consolidation — Phase 1. This is the single source of truth for how
 * every visible count is scoped, classified and owned. No module may invent
 * alternative variants (real / prod / test / pilot_only / legacy_only / tenant /
 * internal_demo) outside of internal adapters that map onto these values.
 */

/** Where a metric lives / what universe it counts over. */
export type MetricScope =
  | 'national'
  | 'organization'
  | 'user'
  | 'mission'
  | 'incident'
  | 'demo'

/** How a given record (or an aggregate) is classified for operational truth. */
export type DataClassification =
  | 'operational'
  | 'legacy'
  | 'demo'
  | 'pending'
  | 'excluded'
  | 'unresolved_ownership'

/** Who owns a record — drives tenant isolation and legacy handling. */
export type OwnershipClass =
  | 'tenant_owned'
  | 'global_public_data'
  | 'legacy_unowned'
  | 'demo_owned'
  | 'system_internal'

export const METRIC_SCOPES: readonly MetricScope[] = [
  'national',
  'organization',
  'user',
  'mission',
  'incident',
  'demo',
] as const

export const DATA_CLASSIFICATIONS: readonly DataClassification[] = [
  'operational',
  'legacy',
  'demo',
  'pending',
  'excluded',
  'unresolved_ownership',
] as const

export const OWNERSHIP_CLASSES: readonly OwnershipClass[] = [
  'tenant_owned',
  'global_public_data',
  'legacy_unowned',
  'demo_owned',
  'system_internal',
] as const

/**
 * Forbidden classification variants. The product-truth audit fails if any of
 * these strings appear as a scope/classification/ownership value in the
 * registry or in a metric payload. They may only exist inside private adapters.
 */
export const FORBIDDEN_CLASSIFICATION_VARIANTS: readonly string[] = [
  'real',
  'prod',
  'test',
  'pilot_only',
  'legacy_only',
  'tenant',
  'internal_demo',
] as const

export function isMetricScope(value: unknown): value is MetricScope {
  return typeof value === 'string' && (METRIC_SCOPES as readonly string[]).includes(value)
}

export function isDataClassification(value: unknown): value is DataClassification {
  return typeof value === 'string' && (DATA_CLASSIFICATIONS as readonly string[]).includes(value)
}

export function isOwnershipClass(value: unknown): value is OwnershipClass {
  return typeof value === 'string' && (OWNERSHIP_CLASSES as readonly string[]).includes(value)
}

/* -------------------------------------------------------------------------- */
/* Canonical time windows                                                     */
/* -------------------------------------------------------------------------- */

/** Canonical time windows. Every metric must declare one of these. */
export type TimeWindowKey = '24h' | '48h' | '7d' | '30d' | 'all_time' | 'current_state'

export const TIME_WINDOW_KEYS: readonly TimeWindowKey[] = [
  '24h',
  '48h',
  '7d',
  '30d',
  'all_time',
  'current_state',
] as const

export interface TimeWindowDefinition {
  key: TimeWindowKey
  /** Human label shown in the UI (Spanish). */
  label: string
  /** Rolling duration in hours; null for non-rolling windows. */
  hours: number | null
}

export const TIME_WINDOWS: Record<TimeWindowKey, TimeWindowDefinition> = {
  '24h': { key: '24h', label: 'Últimas 24 horas', hours: 24 },
  '48h': { key: '48h', label: 'Últimas 48 horas', hours: 48 },
  '7d': { key: '7d', label: 'Últimos 7 días', hours: 24 * 7 },
  '30d': { key: '30d', label: 'Últimos 30 días', hours: 24 * 30 },
  all_time: { key: 'all_time', label: 'Histórico completo', hours: null },
  current_state: { key: 'current_state', label: 'Estado actual', hours: null },
}

export function isTimeWindowKey(value: unknown): value is TimeWindowKey {
  return typeof value === 'string' && (TIME_WINDOW_KEYS as readonly string[]).includes(value)
}

/** Resolve a rolling window to concrete ISO from/to bounds (or null bounds for non-rolling). */
export function resolveTimeWindow(
  key: TimeWindowKey,
  now: Date = new Date(),
): { from: string | null; to: string | null; label: string } {
  const def = TIME_WINDOWS[key]
  if (def.hours == null) {
    return { from: null, to: null, label: def.label }
  }
  const to = now
  const from = new Date(now.getTime() - def.hours * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString(), label: def.label }
}
