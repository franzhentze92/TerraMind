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

describe('resolveFirePipelineStatus legacy adapter', () => {
  it('returns Spanish current status when healthy', () => {
    const status = resolveFirePipelineStatus(health({}))
    expect(status.label).toBe('Datos actualizados')
  })

  it('maps delayed pipeline to Datos retrasados', () => {
    const status = resolveFirePipelineStatus(
      health({ is_healthy: false, is_stale: true, alert_level: 'warning' }),
    )
    expect(status.label).toBe('Datos retrasados')
  })

  it('maps critical alert to Proceso con fallos', () => {
    const status = resolveFirePipelineStatus(
      health({ alert_level: 'critical', consecutive_failures: 3, is_healthy: false }),
    )
    expect(status.label).toBe('Proceso con fallos')
  })
})
