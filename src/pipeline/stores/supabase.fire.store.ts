import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import type {
  FireDetectionRow,
  IngestionRunRecord,
  IngestionRunStatus,
  UpsertMetrics,
} from '@/pipeline/stores/fire.types'

type ExistingDetection = Pick<
  FireDetectionRow,
  | 'dedup_key'
  | 'frp_mw'
  | 'brightness'
  | 'confidence_raw'
  | 'confidence_normalized'
  | 'daynight'
  | 'satellite'
  | 'instrument'
  | 'data_version'
  | 'raw_payload'
  | 'first_seen_at'
>

function coalesce<T>(incoming: T | null | undefined, existing: T | null): T | null {
  if (incoming !== null && incoming !== undefined) return incoming
  return existing ?? null
}

export async function createIngestionRun(input: {
  sources_queried: string[]
  day_range: number
  sanitized_request: unknown[]
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('fire_ingestion_runs')
    .insert({
      status: 'running',
      source: 'nasa-firms',
      sources_queried: input.sources_queried,
      day_range: input.day_range,
      sanitized_request: input.sanitized_request,
      http_status: {},
      metadata: {},
    })
    .select('id')
    .single()

  if (error) throw new Error(`No se pudo crear fire_ingestion_runs: ${error.message}`)
  return data.id as string
}

export async function completeIngestionRun(
  runId: string,
  patch: Partial<IngestionRunRecord> & { status: IngestionRunStatus },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('fire_ingestion_runs')
    .update({
      completed_at: patch.completed_at ?? new Date().toISOString(),
      status: patch.status,
      http_status: patch.http_status,
      rows_received: patch.rows_received,
      rows_valid: patch.rows_valid,
      rows_rejected: patch.rows_rejected,
      rows_inserted: patch.rows_inserted,
      rows_updated: patch.rows_updated,
      rows_duplicated: patch.rows_duplicated,
      rows_outside_country: patch.rows_outside_country ?? 0,
      duration_ms: patch.duration_ms,
      error_message: patch.error_message,
      metadata: patch.metadata ?? {},
    })
    .eq('id', runId)

  if (error) throw new Error(`No se pudo actualizar fire_ingestion_runs: ${error.message}`)
}

export async function upsertFireDetections(
  rows: FireDetectionRow[],
): Promise<UpsertMetrics> {
  if (rows.length === 0) {
    return { inserted: 0, updated: 0, duplicated: 0 }
  }

  const supabase = getSupabaseAdmin()
  const dedupKeys = rows.map((r) => r.dedup_key)

  const { data: existingRows, error: fetchError } = await supabase
    .from('fire_detections')
    .select(
      'dedup_key, frp_mw, brightness, confidence_raw, confidence_normalized, daynight, satellite, instrument, data_version, raw_payload, first_seen_at',
    )
    .in('dedup_key', dedupKeys)

  if (fetchError) {
    throw new Error(`Error consultando dedup_keys existentes: ${fetchError.message}`)
  }

  const existingMap = new Map<string, ExistingDetection>(
    (existingRows ?? []).map((r) => [r.dedup_key as string, r as ExistingDetection]),
  )

  const toInsert: FireDetectionRow[] = []
  const toUpdate: Array<Record<string, unknown>> = []
  let duplicated = 0

  const now = new Date().toISOString()

  for (const row of rows) {
    const existing = existingMap.get(row.dedup_key)
    if (!existing) {
      toInsert.push(row)
      continue
    }

    duplicated++
    toUpdate.push({
      dedup_key: row.dedup_key,
      ingestion_run_id: row.ingestion_run_id,
      last_seen_at: now,
      frp_mw: coalesce(row.frp_mw, existing.frp_mw),
      brightness: coalesce(row.brightness, existing.brightness),
      confidence_raw: coalesce(row.confidence_raw, existing.confidence_raw),
      confidence_normalized: coalesce(
        row.confidence_normalized,
        existing.confidence_normalized,
      ),
      daynight: coalesce(row.daynight, existing.daynight),
      satellite: coalesce(row.satellite, existing.satellite),
      instrument: coalesce(row.instrument, existing.instrument),
      data_version: coalesce(row.data_version, existing.data_version),
      raw_payload: row.raw_payload ?? existing.raw_payload,
    })
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase.from('fire_detections').insert(toInsert)
    if (insertError) {
      throw new Error(`Error insertando fire_detections: ${insertError.message}`)
    }
  }

  for (const patch of toUpdate) {
    const { dedup_key, ...fields } = patch
    const { error: updateError } = await supabase
      .from('fire_detections')
      .update(fields)
      .eq('dedup_key', dedup_key as string)

    if (updateError) {
      throw new Error(`Error actualizando ${dedup_key}: ${updateError.message}`)
    }
  }

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    duplicated,
  }
}
