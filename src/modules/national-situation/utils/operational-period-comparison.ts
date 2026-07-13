/**
 * Operational stock comparison between the current moment and the start of the
 * selected dashboard period. Used by Situación Nacional for honest ↑/↓ trends.
 */
export interface OperationalPeriodMetricComparison {
  current: number
  previous: number
}

export interface OperationalPeriodComparison {
  period_hours: number
  as_of: string
  metrics: {
    verifications: OperationalPeriodMetricComparison
    missions: OperationalPeriodMetricComparison
    evidence: OperationalPeriodMetricComparison
    decisions: OperationalPeriodMetricComparison
    responses: OperationalPeriodMetricComparison
  }
}

export function computePeriodTrendPercent(
  current: number,
  previous: number,
): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null
  if (previous <= 0) {
    return current > 0 ? 100 : current === 0 ? 0 : null
  }
  return Math.round(((current - previous) / previous) * 100)
}

const ACTIVE_PLAN_STATUSES = new Set(['draft', 'ready', 'not_required', 'blocked'])

/**
 * Canonical "misión activa" definition (approved / assigned / in execution).
 * Single source of truth shared by the server comparison and the client
 * fallback (`countActiveMissions`). `accepted` belongs to mission assignments;
 * kept here for forward-compatibility even though `missions.status` never uses
 * it today. Excludes draft, ready, completed, inconclusive, cancelled, expired
 * and failed.
 */
export const ACTIVE_MISSION_STATUSES = new Set([
  'approved',
  'assigned',
  'accepted',
  'in_progress',
  'blocked',
])
const PENDING_EVIDENCE_STATUSES = new Set([
  'submitted',
  'pending',
  'pending_review',
  'under_review',
])

/**
 * Formal pending decisions only. In the real schema (`decision_records`) an
 * automatic recommendation has `decision_type = 'system_recommendation'` and
 * `decision_status = 'recommended'` — it is NOT a pending decision. A formal
 * human decision awaiting authority action is `decision_status = 'pending_review'`
 * (the caller must also restrict to `decision_type = 'human_decision'`). We never
 * count `recommended` here.
 */
export const FORMAL_PENDING_DECISION_STATUSES = new Set(['pending_review'])

interface TimestampedRow {
  created_at?: string | null
  updated_at?: string | null
  status?: string | null
  superseded_at?: string | null
  completed_at?: string | null
  cancelled_at?: string | null
}

function wasActiveAt<T extends TimestampedRow>(
  row: T,
  atMs: number,
  isActiveNow: (row: T) => boolean,
): boolean {
  const created = row.created_at ? new Date(row.created_at).getTime() : NaN
  if (!Number.isFinite(created) || created > atMs) return false

  const superseded = row.superseded_at ? new Date(row.superseded_at).getTime() : null
  if (superseded !== null && superseded <= atMs) return false

  const completed = row.completed_at ? new Date(row.completed_at).getTime() : null
  if (completed !== null && completed <= atMs) return false

  const cancelled = row.cancelled_at ? new Date(row.cancelled_at).getTime() : null
  if (cancelled !== null && cancelled <= atMs) return false

  if (isActiveNow(row)) return true

  // Terminal now but ended after the cutoff — still counted as active at cutoff.
  if (completed !== null && completed > atMs) return true
  if (cancelled !== null && cancelled > atMs) return true
  return false
}

function countAt<T extends TimestampedRow>(
  rows: T[],
  atMs: number,
  isActiveNow: (row: T) => boolean,
): number {
  return rows.filter((row) => wasActiveAt(row, atMs, isActiveNow)).length
}

export function buildOperationalPeriodComparison(input: {
  periodHours: number
  asOf?: Date
  plans: TimestampedRow[]
  missions: TimestampedRow[]
  evidence: TimestampedRow[]
  decisions: TimestampedRow[]
  responses: TimestampedRow[]
}): OperationalPeriodComparison {
  const asOf = input.asOf ?? new Date()
  const cutoffMs = asOf.getTime() - input.periodHours * 3_600_000

  const verificationsNow = input.plans.filter((p) => ACTIVE_PLAN_STATUSES.has(String(p.status))).length
  const missionsNow = input.missions.filter((m) =>
    ACTIVE_MISSION_STATUSES.has(String(m.status)),
  ).length
  const evidenceNow = input.evidence.filter((e) =>
    PENDING_EVIDENCE_STATUSES.has(String(e.status)),
  ).length
  const decisionsNow = input.decisions.filter((d) =>
    FORMAL_PENDING_DECISION_STATUSES.has(String(d.status)),
  ).length
  const responsesNow = input.responses.length

  const verificationsPrev = countAt(input.plans, cutoffMs, (p) =>
    ACTIVE_PLAN_STATUSES.has(String(p.status)),
  )
  const missionsPrev = countAt(input.missions, cutoffMs, (m) =>
    ACTIVE_MISSION_STATUSES.has(String(m.status)),
  )
  const evidencePrev = countAt(input.evidence, cutoffMs, (e) =>
    PENDING_EVIDENCE_STATUSES.has(String(e.status)),
  )
  const decisionsPrev = countAt(input.decisions, cutoffMs, (d) =>
    FORMAL_PENDING_DECISION_STATUSES.has(String(d.status)),
  )
  const responsesPrev = countAt(input.responses, cutoffMs, () => true)

  return {
    period_hours: input.periodHours,
    as_of: asOf.toISOString(),
    metrics: {
      verifications: { current: verificationsNow, previous: verificationsPrev },
      missions: { current: missionsNow, previous: missionsPrev },
      evidence: { current: evidenceNow, previous: evidencePrev },
      decisions: { current: decisionsNow, previous: decisionsPrev },
      responses: { current: responsesNow, previous: responsesPrev },
    },
  }
}
