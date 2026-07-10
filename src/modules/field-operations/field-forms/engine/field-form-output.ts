import { createHash } from 'node:crypto'

import type { FieldFormOutputPayload, FieldFormResponseStatus } from '@/modules/field-operations/field-forms/field-form.types'

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    )
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]))
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

export function fieldFormOutputChecksum(payload: Omit<FieldFormOutputPayload, 'checksum'>): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex')
}

export function buildFieldFormOutput(input: {
  response_id: string
  mission_id: string
  task_id: string
  requirement_id: string | null
  schema_id: string
  schema_version: string
  status: FieldFormResponseStatus
  answers: Record<string, unknown>
  limitations: string[]
  captured_at: string
  device_location: Record<string, unknown>
  package_version: number
  package_id: string
}): FieldFormOutputPayload {
  const body = {
    response_id: input.response_id,
    mission_id: input.mission_id,
    task_id: input.task_id,
    requirement_id: input.requirement_id,
    schema_id: input.schema_id,
    schema_version: input.schema_version,
    status: input.status,
    answers: input.answers,
    limitations: input.limitations,
    captured_at: input.captured_at,
    device_location: input.device_location,
    package_version: input.package_version,
    package_id: input.package_id,
  }
  return { ...body, checksum: fieldFormOutputChecksum(body) }
}

export function stableFinalizeChecksum(
  outputA: FieldFormOutputPayload,
  outputB: FieldFormOutputPayload,
): boolean {
  return outputA.checksum === outputB.checksum
}
