import { hostname } from 'node:os'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import {
  FIRE_PIPELINE_LOCK_KEY,
  type FirePipelineRunStatus,
  type FirePipelineTriggerType,
} from '@/pipeline/config/fire-pipeline.config'

export interface PipelineStageRecord {
  status: 'success' | 'partial' | 'failed' | 'skipped'
  duration_ms: number
  metrics?: Record<string, unknown>
  error?: string
  error_code?: string
}

export interface PipelineRunRow {
  id: string
  trigger_type: FirePipelineTriggerType
  status: FirePipelineRunStatus
  started_at: string
  completed_at: string | null
  duration_ms: number | null
  host_identifier: string | null
  lock_key: string
  ingestion_run_id: string | null
  stages: Record<string, PipelineStageRecord>
  metrics: Record<string, unknown>
  error_message: string | null
  retry_of: string | null
  created_at: string
}

export async function tryAcquirePipelineLock(): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('fire_pipeline_try_advisory_lock')
  if (error) throw new Error(`No se pudo adquirir lock del pipeline: ${error.message}`)
  return Boolean(data)
}

export async function releasePipelineLock(): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('fire_pipeline_release_advisory_lock')
  if (error) throw new Error(`No se pudo liberar lock del pipeline: ${error.message}`)
  return Boolean(data)
}

export async function createPipelineRun(input: {
  trigger_type: FirePipelineTriggerType
  retry_of?: string | null
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_pipeline_runs')
    .insert({
      trigger_type: input.trigger_type,
      status: 'running',
      host_identifier: hostname(),
      lock_key: FIRE_PIPELINE_LOCK_KEY,
      retry_of: input.retry_of ?? null,
      stages: {},
      metrics: {},
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new PipelineConcurrencyError()
    }
    throw new Error(`No se pudo crear fire_pipeline_run: ${error.message}`)
  }
  return data.id as string
}

export async function createSkippedPipelineRun(input: {
  trigger_type: FirePipelineTriggerType
  retry_of?: string | null
  reason: string
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('fire_pipeline_runs')
    .insert({
      trigger_type: input.trigger_type,
      status: 'skipped',
      started_at: now,
      completed_at: now,
      duration_ms: 0,
      host_identifier: hostname(),
      lock_key: FIRE_PIPELINE_LOCK_KEY,
      retry_of: input.retry_of ?? null,
      stages: {},
      metrics: { reason: input.reason },
      error_message: input.reason,
    })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo registrar corrida omitida: ${error.message}`)
  return data.id as string
}

export class PipelineConcurrencyError extends Error {
  constructor() {
    super('concurrent_run')
    this.name = 'PipelineConcurrencyError'
  }
}

export async function completePipelineRun(
  id: string,
  input: {
    status: FirePipelineRunStatus
    duration_ms: number
    ingestion_run_id?: string | null
    stages: Record<string, PipelineStageRecord>
    metrics: Record<string, unknown>
    error_message?: string | null
  },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('fire_pipeline_runs')
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      duration_ms: input.duration_ms,
      ingestion_run_id: input.ingestion_run_id ?? null,
      stages: input.stages,
      metrics: input.metrics,
      error_message: input.error_message ?? null,
    })
    .eq('id', id)

  if (error) throw new Error(`No se pudo completar fire_pipeline_run: ${error.message}`)
}

export async function getLatestPipelineRun(): Promise<PipelineRunRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_pipeline_runs')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as PipelineRunRow | null) ?? null
}

export async function getLastSuccessfulPipelineRun(): Promise<PipelineRunRow | null> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_pipeline_runs')
    .select('*')
    .in('status', ['success', 'partial'])
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as PipelineRunRow | null) ?? null
}

export async function countConsecutiveFailures(): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_pipeline_runs')
    .select('status')
    .neq('status', 'skipped')
    .order('started_at', { ascending: false })
    .limit(20)

  if (error) throw new Error(error.message)

  let count = 0
  for (const row of data ?? []) {
    if (row.status === 'failed') count++
    else break
  }
  return count
}

export async function countRunsSince(
  status: FirePipelineRunStatus,
  sinceIso: string,
): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('fire_pipeline_runs')
    .select('id', { count: 'exact', head: true })
    .eq('status', status)
    .gte('started_at', sinceIso)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function hasRecentRetryParent(parentId: string, sinceIso: string): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('fire_pipeline_runs')
    .select('id', { count: 'exact', head: true })
    .eq('retry_of', parentId)
    .gte('started_at', sinceIso)

  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export interface StatusRefreshMetrics {
  rows_updated: number
  events_activated: number
  events_monitoring: number
  events_closed: number
  events_unchanged: number
}

export async function refreshEventStatusesDetailed(): Promise<StatusRefreshMetrics> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.rpc('fire_events_refresh_temporal_status_metrics')
  if (error) {
    throw new Error(`Error actualizando estados temporales: ${error.message}`)
  }
  const metrics = (data ?? {}) as StatusRefreshMetrics
  return {
    rows_updated: Number(metrics.rows_updated ?? 0),
    events_activated: Number(metrics.events_activated ?? 0),
    events_monitoring: Number(metrics.events_monitoring ?? 0),
    events_closed: Number(metrics.events_closed ?? 0),
    events_unchanged: Number(metrics.events_unchanged ?? 0),
  }
}

export async function countNationalDetectionsPendingCluster(): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('fire_detections')
    .select('id', { count: 'exact', head: true })
    .eq('is_inside_guatemala', true)
    .eq('geography_method', 'postgis_polygon')
    .eq('geography_confidence', 'high')

  if (error) throw new Error(error.message)
  return count ?? 0
}
