import { describe, expect, it } from 'vitest'
import { computeHealthFlags } from '../../../server/services/fire-pipeline-health.service.js'
import { PIPELINE_HEALTH_THRESHOLDS } from '@/pipeline/config/fire-pipeline.config'

describe('pipeline health flags', () => {
  it('marks healthy when recent success and no failures', () => {
    const flags = computeHealthFlags({
      consecutiveFailures: 0,
      lastSuccessAt: new Date().toISOString(),
      enabled: true,
    })
    expect(flags.is_healthy).toBe(true)
    expect(flags.alert_level).toBe('ok')
  })

  it('warns after consecutive failures threshold', () => {
    const flags = computeHealthFlags({
      consecutiveFailures: PIPELINE_HEALTH_THRESHOLDS.warningConsecutiveFailures,
      lastSuccessAt: new Date().toISOString(),
      enabled: true,
    })
    expect(flags.is_healthy).toBe(false)
    expect(flags.alert_level).toBe('warning')
  })

  it('marks critical when stale beyond 4 hours', () => {
    const stale = new Date(
      Date.now() - PIPELINE_HEALTH_THRESHOLDS.criticalStaleMinutes * 60_000 - 1,
    ).toISOString()
    const flags = computeHealthFlags({
      consecutiveFailures: 0,
      lastSuccessAt: stale,
      enabled: true,
    })
    expect(flags.alert_level).toBe('critical')
    expect(flags.is_stale).toBe(true)
  })

  it('ignores health when scheduler disabled', () => {
    const flags = computeHealthFlags({
      consecutiveFailures: 10,
      lastSuccessAt: null,
      enabled: false,
    })
    expect(flags.is_healthy).toBe(true)
  })
})
