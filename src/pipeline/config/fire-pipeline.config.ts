export const FIRE_PIPELINE_LOCK_KEY = 'terramind_fire_pipeline'

export const PIPELINE_TIMEOUTS_MS = {
  firmsSource: 30_000,
  ingestionTotal: 3 * 60_000,
  geography: 60_000,
  clustering: 2 * 60_000,
  pipelineTotal: 7 * 60_000,
} as const

export const PIPELINE_RETRY = {
  maxAttempts: 3,
  backoffMs: [30_000, 90_000] as const,
  jitterMs: 5_000,
  minRetryIntervalMs: 60 * 60_000,
} as const

export const PIPELINE_HEALTH_THRESHOLDS = {
  warningConsecutiveFailures: 2,
  criticalConsecutiveFailures: 4,
  warningStaleMinutes: 90,
  criticalStaleMinutes: 240,
} as const

export type FirePipelineTriggerType = 'scheduled' | 'manual' | 'startup' | 'retry'
export type FirePipelineRunStatus = 'running' | 'success' | 'partial' | 'failed' | 'skipped'

export interface FirePipelineConfig {
  enabled: boolean
  intervalMinutes: number
  runOnStartup: boolean
  timezone: string
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function parseIntervalMinutes(): number {
  const raw = Number(process.env.FIRE_PIPELINE_INTERVAL_MINUTES ?? 30)
  if (!Number.isFinite(raw)) return 30
  return Math.min(1440, Math.max(15, Math.round(raw)))
}

export function loadFirePipelineConfig(): FirePipelineConfig {
  return {
    enabled: parseBool(process.env.FIRE_PIPELINE_ENABLED, true),
    intervalMinutes: parseIntervalMinutes(),
    runOnStartup: parseBool(process.env.FIRE_PIPELINE_RUN_ON_STARTUP, false),
    timezone: process.env.FIRE_PIPELINE_TIMEZONE?.trim() || 'America/Guatemala',
  }
}

export function sanitizeFirePipelineConfigForLogs(
  config: FirePipelineConfig,
): Record<string, string | number | boolean> {
  return {
    enabled: config.enabled,
    interval_minutes: config.intervalMinutes,
    run_on_startup: config.runOnStartup,
    timezone: config.timezone,
  }
}
