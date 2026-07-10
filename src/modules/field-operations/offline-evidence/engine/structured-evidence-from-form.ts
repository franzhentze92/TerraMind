import { randomUUID } from 'node:crypto'

import { evidenceTypeForSchema } from '@/modules/field-operations/offline-evidence/config/fire-offline-evidence.config'
import { structuredPayloadChecksum } from '@/modules/field-operations/offline-evidence/engine/offline-evidence-checksum'
import type { LocalEvidenceType } from '@/modules/field-operations/offline-evidence/offline-evidence.types'
import type { FieldFormOutputPayload } from '@/modules/field-operations/field-forms/field-form.types'

export function buildStructuredEvidencePayload(output: FieldFormOutputPayload): Record<string, unknown> {
  return {
    response_id: output.response_id,
    schema_id: output.schema_id,
    schema_version: output.schema_version,
    status: output.status,
    answers: output.answers,
    limitations: output.limitations,
    captured_at: output.captured_at,
    device_location: output.device_location,
    form_output_checksum: output.checksum,
  }
}

export function evidenceTypeFromFormOutput(output: FieldFormOutputPayload): LocalEvidenceType {
  return evidenceTypeForSchema(output.schema_id) ?? 'structured_observation'
}

export function structuredEvidenceChecksum(output: FieldFormOutputPayload): string {
  return structuredPayloadChecksum(buildStructuredEvidencePayload(output))
}

export function formOutputDedupKey(output: FieldFormOutputPayload, contextSignature: string): string {
  return `${contextSignature}:${output.checksum}:${output.task_id}`
}

export function createTimestampCapture(nowIso: string, deviceTimestamp?: string) {
  const device = deviceTimestamp ?? nowIso
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const offset = -new Date(nowIso).getTimezoneOffset()
  const skew = Math.abs(Date.parse(device) - Date.parse(nowIso)) > 120_000
  return {
    device_timestamp: device,
    app_captured_at: nowIso,
    timezone: tz,
    utc_offset_minutes: offset,
    clock_skew_warning: skew,
  }
}

export function newEvidenceId(): string {
  return randomUUID()
}

export function newAssetId(): string {
  return randomUUID()
}

export function newBundleId(): string {
  return randomUUID()
}

export function newEventId(): string {
  return randomUUID()
}
