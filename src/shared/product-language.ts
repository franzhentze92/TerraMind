/**
 * Centralized product language (Spanish UI terminology).
 *
 * Product Consolidation — Phase 1. Single place that maps internal terms to the
 * words the product actually shows. Internal phase codes (8B.5, 8C.1, ...) must
 * never reach the UI; `assertNoInternalPhaseCode` guards against that.
 */

import type {
  DataClassification,
  MetricScope,
  OwnershipClass,
} from '@/modules/executive-metrics/metric-taxonomy'

/** Internal token -> visible Spanish label (from Phase 1 spec §8). */
export const PRODUCT_LANGUAGE: Record<string, string> = {
  response_assessment: 'evaluación de respuesta',
  downstream_reevaluation: 'reevaluaciones posteriores',
  pending_sync: 'pendiente de sincronización',
  internal_demo: 'demostración interna',
  draft: 'borrador',
  tenant_owned: 'Operacional',
  ownership_unresolved: 'Organización pendiente',
  inferred: 'inferido',
  ready_for_validation: 'Lista para validación',
  not_required: 'no requerida',
  useful: 'útil',
  prepare: 'preparar',
  monitor: 'monitoreo',
  legacy_unowned: 'Legacy · organización pendiente',
  lifecycle_persistent: 'Persistente',
  lifecycle_expanding: 'En expansión',
  lifecycle_declining: 'En descenso',
  partially_satisfied: 'Parcialmente resuelta',
  conflicting_evidence: 'Evidencia contradictoria',
  pilot: 'Demostración interna',
  allowlist: 'lista de cuentas habilitadas',
  fixture: 'demostración',
  model_version: 'versión del modelo',
}

/** Terms that must never appear in product UI (audit checks these). */
export const FORBIDDEN_UI_TERMS = [
  'tenant-owned',
  'ownership_unresolved',
  'response assessment',
  'downstream',
  'pending sync',
  'internal_demo',
  'allowlist',
  'fixture sintético',
  'Sync simulado',
  '8B.7G',
  '8C.1',
  'ready_for_validation',
  'lifecycle_persistent',
  'model version',
  'producción global bloqueada',
] as const

/** Canonical scope labels for the UI. */
export const SCOPE_LABELS: Record<MetricScope, string> = {
  national: 'Nacional',
  organization: 'Organización',
  user: 'Usuario',
  mission: 'Misión',
  incident: 'Incidente',
  demo: 'Demostración interna',
}

/** Canonical data-classification labels for the UI. */
export const CLASSIFICATION_LABELS: Record<DataClassification, string> = {
  operational: 'Operacional',
  legacy: 'Legacy',
  demo: 'Demostración interna',
  pending: 'Pendiente de procesamiento',
  excluded: 'Excluido',
  unresolved_ownership: 'Organización pendiente',
}

/** Short badge text per classification (compact surfaces). */
export const CLASSIFICATION_BADGES: Record<DataClassification, string> = {
  operational: 'Operacional',
  legacy: 'Legacy',
  demo: 'Demostración',
  pending: 'Pendiente',
  excluded: 'Excluido',
  unresolved_ownership: 'Org. pendiente',
}

/** Canonical ownership labels for the UI. */
export const OWNERSHIP_LABELS: Record<OwnershipClass, string> = {
  tenant_owned: 'Perteneciente a la organización',
  global_public_data: 'Dato público nacional',
  legacy_unowned: 'Legacy sin organización',
  demo_owned: 'Demostración interna',
  system_internal: 'Interno del sistema',
}

/** Reasons a breakdown item is excluded from the operational KPI. */
export const EXCLUSION_REASON_LABELS: Record<string, string> = {
  ownership_unresolved: 'Organización pendiente',
  legacy: 'Registro legacy',
  demo: 'Demostración interna',
  out_of_scope: 'Fuera del alcance de la organización',
  pending_processing: 'Pendiente de procesamiento',
}

/** Visible Spanish labels for organization/platform roles. */
export const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Administrador de plataforma',
  organization_admin: 'Administrador de organización',
  operations_coordinator: 'Coordinador de operaciones',
  field_supervisor: 'Supervisor de campo',
  field_technician: 'Técnico de campo',
  analyst: 'Analista',
  viewer: 'Consulta',
}

/** Visible Spanish labels for membership status. */
export const MEMBERSHIP_STATUS_LABELS: Record<string, string> = {
  invited: 'Invitado',
  active: 'Activo',
  suspended: 'Suspendido',
  revoked: 'Revocado',
  pending: 'Pendiente',
}

/** Visible Spanish labels for evidence types. */
export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  photo: 'Fotografía',
  video: 'Video',
  structured_observation: 'Observación estructurada',
  document: 'Documento',
  audio: 'Audio',
  gps_track: 'Recorrido GPS',
  sensor_reading: 'Lectura de sensor',
}

/** Visible Spanish labels for assignment / participation roles. */
export const PARTICIPATION_LABELS: Record<string, string> = {
  primary: 'Principal',
  joined: 'Incorporado',
  secondary: 'Secundario',
  support: 'Apoyo',
  observer: 'Observador',
}

/**
 * Fallback for any snake_case / kebab enum that lacks an explicit label.
 * Converts `some_internal_value` → `Some internal value` so raw codes never
 * reach the UI even when a dictionary entry is missing.
 */
export function humanizeToken(token: string): string {
  const cleaned = token.replace(/[_-]+/g, ' ').trim()
  if (!cleaned) return token
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

/** Look up a visible label for an internal token, falling back to a humanized form. */
export function productLabel(token: string): string {
  return PRODUCT_LANGUAGE[token] ?? humanizeToken(token)
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? humanizeToken(role)
}

export function membershipStatusLabel(status: string): string {
  return MEMBERSHIP_STATUS_LABELS[status] ?? humanizeToken(status)
}

export function evidenceTypeLabel(type: string): string {
  return EVIDENCE_TYPE_LABELS[type] ?? humanizeToken(type)
}

export function participationLabel(role: string): string {
  return PARTICIPATION_LABELS[role] ?? humanizeToken(role)
}

export function scopeLabel(scope: MetricScope): string {
  return SCOPE_LABELS[scope]
}

export function classificationLabel(classification: DataClassification): string {
  return CLASSIFICATION_LABELS[classification]
}

export function classificationBadge(classification: DataClassification): string {
  return CLASSIFICATION_BADGES[classification]
}

export function ownershipLabel(ownership: OwnershipClass): string {
  return OWNERSHIP_LABELS[ownership]
}

export function exclusionReasonLabel(reason: string): string {
  return EXCLUSION_REASON_LABELS[reason] ?? reason
}

/**
 * Internal phase codes that must never appear in product-facing UI copy.
 * Pattern: a digit, a letter, optional .N, optional trailing letter (8B.5, 8C.1, 8B.7G).
 */
export const INTERNAL_PHASE_CODE_PATTERN = /\b\d[A-Z](?:\.\d+)?[A-Z]?\b/g

/** Returns every internal phase code found in a string (empty if none). */
export function findInternalPhaseCodes(text: string): string[] {
  const matches = text.match(INTERNAL_PHASE_CODE_PATTERN)
  return matches ? Array.from(new Set(matches)) : []
}

/** Throws if any internal phase code is present. Used by the product-truth audit and copy guards. */
export function assertNoInternalPhaseCode(text: string, context = 'UI copy'): void {
  const codes = findInternalPhaseCodes(text)
  if (codes.length > 0) {
    throw new Error(
      `Internal phase code(s) [${codes.join(', ')}] must not appear in ${context}: "${text}"`,
    )
  }
}
