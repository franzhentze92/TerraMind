import { describe, expect, it } from 'vitest'
import {
  buildOperationalPeriodComparison,
  computePeriodTrendPercent,
} from './operational-period-comparison'
import { buildOperationalStatusCardModels } from './operational-status-panel-model'

describe('buildOperationalPeriodComparison', () => {
  it('estimates previous stock from timestamps', () => {
    const now = Date.now()
    const twoDaysAgo = new Date(now - 72 * 3_600_000).toISOString()
    const oneDayAgo = new Date(now - 24 * 3_600_000).toISOString()

    const comparison = buildOperationalPeriodComparison({
      periodHours: 48,
      asOf: new Date(now),
      plans: [
        { status: 'ready', created_at: twoDaysAgo },
        { status: 'ready', created_at: oneDayAgo },
      ],
      missions: [
        {
          status: 'in_progress',
          created_at: twoDaysAgo,
          completed_at: null,
          cancelled_at: null,
        },
      ],
      evidence: [
        { status: 'pending_review', created_at: twoDaysAgo },
        { status: 'pending_review', created_at: oneDayAgo },
      ],
      decisions: [
        { status: 'pending_review', created_at: oneDayAgo },
        // Automatic recommendation — must NOT count as a pending decision.
        { status: 'recommended', created_at: oneDayAgo },
      ],
      responses: [{ created_at: oneDayAgo }],
    })

    expect(comparison.metrics.verifications.current).toBe(2)
    expect(comparison.metrics.verifications.previous).toBe(1)
    expect(comparison.metrics.missions.current).toBe(1)
    expect(comparison.metrics.evidence.current).toBe(2)
    // Only the formal pending_review decision counts; 'recommended' is excluded.
    expect(comparison.metrics.decisions.current).toBe(1)
    expect(computePeriodTrendPercent(2, 1)).toBe(100)
  })
})

describe('buildOperationalStatusCardModels', () => {
  it('uses period comparison for values and colored trends', () => {
    const cards = buildOperationalStatusCardModels({
      comparison: {
        period_hours: 48,
        as_of: new Date().toISOString(),
        metrics: {
          verifications: { current: 56, previous: 47 },
          missions: { current: 22, previous: 18 },
          evidence: { current: 48, previous: 43 },
          decisions: { current: 27, previous: 30 },
          responses: { current: 9, previous: 8 },
        },
      },
      fallback: {
        verifications: 4,
        missions: 0,
        evidence: 0,
        decisions: 0,
        responses: 0,
      },
    })

    expect(cards[0]?.value).toBe(56)
    expect(cards[0]?.trendLabel).toBe('↑ 19%')
    expect(cards[3]?.trendLabel).toBe('↓ 10%')
    expect(cards[1]?.trendLabel).toContain('%')
  })
})
