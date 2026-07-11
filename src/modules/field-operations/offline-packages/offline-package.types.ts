import { createHash } from 'node:crypto'
import type { ConditionalRule } from '@/modules/field-operations/field-forms/field-form.types'

export const OFFLINE_PACKAGE_MODEL_VERSION = '1.0.0'

export const OFFLINE_PACKAGE_STATUSES = [
  'queued',
  'generating',
  'ready',
  'downloaded',
  'superseded',
  'revoked',
  'expired',
  'generation_failed',
] as const

export type OfflinePackageStatus = (typeof OFFLINE_PACKAGE_STATUSES)[number]

export const LOCAL_OFFLINE_PACKAGE_STATUSES = [
  'downloading',
  'available',
  'integrity_failed',
  'superseded',
  'revoked',
  'expired',
  'pending_deletion',
] as const

export type LocalOfflinePackageStatus = (typeof LOCAL_OFFLINE_PACKAGE_STATUSES)[number]

export type OfflinePackagePermission =
  | 'offline_packages.generate'
  | 'offline_packages.download'
  | 'offline_packages.view'
  | 'offline_packages.revoke'
  | 'offline_packages.view_sensitive'
  | 'offline_packages.download_historical'

export type OfflinePackageGenerationDecision =
  | 'generate_package'
  | 'not_eligible'
  | 'duplicate_exists'
  | 'supersede_required'
  | 'no_action'

export interface OfflinePackageManifestFile {
  path: string
  mime_type: string
  size_bytes: number
  sha256: string
}

export interface OfflinePackageManifest {
  package_id: string
  package_version: number
  mission_id: string
  mission_profile_version: string
  offline_package_model_version: string
  generated_at: string
  generated_by: string | null
  valid_from: string
  valid_until: string
  supersedes_package_id: string | null
  context_signature: string
  files: OfflinePackageManifestFile[]
  manifest_sha256: string
  signature: string
  signature_algorithm: string
  map_resource_manifest?: Record<string, unknown>
}

export interface OfflineMissionSnapshot {
  mission_id: string
  title: string
  objective: string
  mission_type: string
  priority: number
  status: string
  earliest_start_at: string
  due_at: string
  expires_at: string
  completion_criteria: string
  inconclusive_criteria: string
  blocking_conditions: string[]
  cancellation_conditions: string[]
  operational_window: {
    earliest_start_at: string
    due_at: string
    expires_at: string
  }
}

export interface OfflineOriginSnapshot {
  incident_id: string
  verification_plan_id: string
  verification_needs: Array<{
    id: string
    need_type: string
    need_question: string
    priority: number
    recommended_method_code: string | null
  }>
  recommended_method_code: string
  primary_reasons: string[]
  limitations: string[]
  safe_summary: string
}

export interface OfflineLocationSnapshot {
  geometry: Record<string, unknown> | null
  centroid: { lat: number; lng: number } | null
  bounding_box: [number, number, number, number] | null
  location_description: string
  expected_accuracy_m: number | null
  restricted_zones: Array<Record<string, unknown>>
  capture_area: Record<string, unknown> | null
  territorial_references: string[]
}

export interface OfflineTaskSnapshot {
  id: string
  sequence: number
  task_type: string
  title: string
  instructions: string
  required: boolean
  completion_criteria: string
  dependencies: string[]
  blockers: string[]
  initial_status: string
  form_schema_id: string | null
}

export interface OfflineEvidenceRequirementSnapshot {
  id: string
  verification_need_id: string | null
  evidence_type: string
  required: boolean
  minimum_count: number
  required_metadata: string[]
  quality_criteria: string[]
  acceptance_criteria: string
  capture_instructions: string
}

export interface OfflineFormSchema {
  schema_id: string
  schema_version: string
  json_schema: Record<string, unknown>
  ui_schema: Record<string, unknown>
  validation_rules: Record<string, unknown>
  conditional_rules: ConditionalRule[]
  localization: Record<string, string>
}

export interface OfflinePermissionsSnapshot {
  allowed_actions: string[]
  sensitivity_level: 'standard' | 'restricted' | 'minimal'
  can_view_sensitive_location: boolean
}

export interface OfflineRedactionRecord {
  excluded_fields: string[]
  generalized_fields: string[]
  policy_version: string
}

export interface OfflinePackageBuildInput {
  mission: Record<string, unknown>
  tasks: Array<Record<string, unknown>>
  evidence_requirements: Array<Record<string, unknown>>
  assignment: Record<string, unknown> | null
  plan_needs: Array<Record<string, unknown>>
  incident: Record<string, unknown> | null
  permissions: OfflinePackagePermission[]
  actor_id: string | null
  evaluated_at: string
  allow_historical?: boolean
}

export interface OfflinePackageBuildResult {
  decision: OfflinePackageGenerationDecision
  context_signature: string
  package_version: number
  supersedes_package_id: string | null
  valid_from: string
  valid_until: string
  download_expires_at: string
  snapshot: {
    mission: OfflineMissionSnapshot
    origin: OfflineOriginSnapshot
    location: OfflineLocationSnapshot
    tasks: OfflineTaskSnapshot[]
    evidence_requirements: OfflineEvidenceRequirementSnapshot[]
    forms: OfflineFormSchema[]
    permissions: OfflinePermissionsSnapshot
    instructions: { general: string; safety: string[] }
    map_resources: Record<string, unknown>
  }
  payloads: Array<{ path: string; mime_type: string; content: string }>
  redaction: OfflineRedactionRecord
  reasons: string[]
  warnings: string[]
}

export interface OfflinePackageEligibilityResult {
  eligible: boolean
  reasons: string[]
  requires_assignment: boolean
}

export function hashOfflinePackageContext(parts: Record<string, unknown>): string {
  const canonical = JSON.stringify(parts, Object.keys(parts).sort())
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}

export function criteriaText(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && 'text' in value) {
    return String((value as { text?: string }).text ?? '')
  }
  return String(value)
}
