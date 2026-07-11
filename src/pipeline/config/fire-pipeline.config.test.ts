import { describe, expect, it, afterEach } from 'vitest'
import {
  loadFirePipelineConfig,
  sanitizeFirePipelineConfigForLogs,
} from '@/pipeline/config/fire-pipeline.config'

describe('fire pipeline config', () => {
  const env = { ...process.env }

  afterEach(() => {
    process.env = { ...env }
  })

  it('defaults to enabled every 30 minutes', () => {
    delete process.env.FIRE_PIPELINE_ENABLED
    delete process.env.FIRE_PIPELINE_INTERVAL_MINUTES
    const config = loadFirePipelineConfig()
    expect(config.enabled).toBe(true)
    expect(config.intervalMinutes).toBe(30)
    expect(config.timezone).toBe('America/Guatemala')
  })

  it('clamps interval to minimum 15 and maximum 1440', () => {
    process.env.FIRE_PIPELINE_INTERVAL_MINUTES = '5'
    expect(loadFirePipelineConfig().intervalMinutes).toBe(15)
    process.env.FIRE_PIPELINE_INTERVAL_MINUTES = '9999'
    expect(loadFirePipelineConfig().intervalMinutes).toBe(1440)
  })

  it('sanitizes config for logs without secrets', () => {
    const sanitized = sanitizeFirePipelineConfigForLogs(loadFirePipelineConfig())
    expect(sanitized).not.toHaveProperty('NASA_FIRMS_MAP_KEY')
    expect(sanitized.enabled).toBeTypeOf('boolean')
  })
})
