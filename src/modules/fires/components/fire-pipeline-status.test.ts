import { describe, expect, it } from 'vitest'

import { resolveFirePipelineStatus } from '@/modules/fires/components/FirePipelineStatusLine'
import type { FirePipelineHealthDto } from '@/modules/fires/types/fire.dto'

function health(overrides: Partial<FirePipelineHealthDto>): FirePipelineHealthDto {
  return {
    enabled: true,
    interval_minutes: 30,
    is_running: false,
    scheduler_active: true,
    last_run: null,
    last_success_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    consecutive_failures: 0,
    next_run_at: null,
    failed_runs_last_24h: 0,
    partial_runs_last_24h: 0,
    is_healthy: true,
    is_stale: false,
    alert_level: 'ok',
    generated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('Fire pipeline single status', () => {
  it('returns one operational status when healthy', () => {
    const status = resolveFirePipelineStatus(health({}))
    expect(status.state).toBe('operational')
    expect(status.label).toBe('Pipeline operativo')
  })

  it('collapses stale + not healthy + warnings into a single "Datos retrasados"', () => {
    const status = resolveFirePipelineStatus(
      health({ is_healthy: false, is_stale: true, alert_level: 'warning', consecutive_failures: 1 }),
    )
    expect(status.state).toBe('delayed')
    expect(status.label).toBe('Datos retrasados')
    // a single explanation, not multiple badges
    expect(status.explanation).toContain('frecuencia esperada')
  })

  it('critical alert becomes a single failing status', () => {
    const status = resolveFirePipelineStatus(
      health({ is_healthy: false, is_stale: true, alert_level: 'critical', consecutive_failures: 3 }),
    )
    expect(status.state).toBe('failing')
    expect(status.label).toBe('Pipeline con fallos')
  })
})
