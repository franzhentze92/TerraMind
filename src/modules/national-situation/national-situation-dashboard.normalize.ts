/**
 * Canonical normalizer for the executive dashboard DTO consumed by Situación
 * Nacional.
 *
 * Why this exists: the dashboard is assembled from many optional collections
 * (priorities, incidents, decisions, timeline…). A single missing array in the
 * server payload (or an older/stale backend shape) previously crashed the whole
 * page with `Cannot read properties of undefined (reading 'length')`.
 *
 * Contract:
 * - `undefined` in → `undefined` out. We intentionally preserve the "no data
 *   yet / request failed" state instead of fabricating an empty dashboard, so
 *   consumers can still distinguish *missing data* from a real *zero count*.
 * - object in → object out with every expected collection guaranteed to be an
 *   array (missing → `[]`), while `0`/empty values that were genuinely present
 *   are preserved untouched.
 * - When an expected array is missing we emit a `console.warn` in dev so real
 *   contract regressions stay visible instead of being silently swallowed.
 */
import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'

const EXPECTED_ARRAY_KEYS = [
  'metrics',
  'priority_findings',
  'top_priorities',
  'active_incidents',
  'recent_changes',
  'pending_verifications',
  'missions_in_progress',
  'recent_evidence',
  'recent_resolutions',
  'response_recommendations',
  'pending_decisions',
  'empty_sections',
  'data_audit',
] as const satisfies ReadonlyArray<keyof ExecutiveDashboardDto>

function warnMissing(key: string): void {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `[national-situation] Dashboard DTO is missing expected collection "${key}"; defaulting to []. This usually means a stale backend or a broken contract.`,
    )
  }
}

/**
 * Coerce every expected collection of the executive dashboard DTO into an array.
 * Returns `undefined` unchanged so loading/error states remain distinguishable
 * from an empty (but present) dashboard.
 */
export function normalizeNationalSituationDashboardDto(
  dashboard: ExecutiveDashboardDto | undefined,
): ExecutiveDashboardDto | undefined {
  if (!dashboard) return dashboard

  const normalized = { ...dashboard } as Record<string, unknown>
  for (const key of EXPECTED_ARRAY_KEYS) {
    const value = normalized[key]
    if (!Array.isArray(value)) {
      if (value !== undefined && value !== null) {
        // Present but wrong type — still a contract problem worth flagging.
        warnMissing(key)
      } else if (value === undefined) {
        warnMissing(key)
      }
      normalized[key] = []
    }
  }

  return normalized as unknown as ExecutiveDashboardDto
}
