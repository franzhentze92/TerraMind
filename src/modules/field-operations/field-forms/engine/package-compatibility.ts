import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'
import {
  canOpenLocalPackage,
  canStartFieldExecution,
} from '@/modules/field-operations/offline-packages/offline-package.repository'
import type { FieldFormSchemaRecord } from '@/modules/field-operations/field-forms/field-form.types'
import { FieldFormSchemaRegistry } from '@/modules/field-operations/field-forms/engine/schema-registry'

export type PackageFormAccessMode = 'capture' | 'historical' | 'blocked'

export interface PackageFormAccessResult {
  mode: PackageFormAccessMode
  reasons: string[]
}

export function assessPackageFormAccess(
  pkg: LocalOfflinePackageRecord,
  nowIso: string,
  options: { allowHistorical?: boolean } = {},
): PackageFormAccessResult {
  const reasons: string[] = []
  if (!canOpenLocalPackage(pkg)) {
    return { mode: 'blocked', reasons: ['integrity_failed'] }
  }
  if (pkg.local_status === 'revoked') {
    return { mode: 'blocked', reasons: ['package_revoked'] }
  }
  if (pkg.local_status === 'superseded') {
    return { mode: 'blocked', reasons: ['package_superseded'] }
  }
  if (!canStartFieldExecution(pkg, nowIso)) {
    if (options.allowHistorical) return { mode: 'historical', reasons: ['package_expired'] }
    return { mode: 'blocked', reasons: ['package_expired'] }
  }
  if (pkg.local_status === 'integrity_failed') reasons.push('integrity_failed')
  return { mode: 'capture', reasons }
}

export function assessSchemaAccess(
  registry: FieldFormSchemaRegistry,
  schema: FieldFormSchemaRecord | null,
  packageModelVersion: string,
): { ok: boolean; reason?: string } {
  if (!schema) return { ok: false, reason: 'schema_missing' }
  const compat = registry.isCompatible(schema, packageModelVersion)
  if (!compat.compatible) return { ok: false, reason: compat.reason }
  return { ok: true }
}

export function parsePackageTasks(pkg: LocalOfflinePackageRecord): Array<Record<string, unknown>> {
  const tasksPayload = pkg.payloads.find((p) => p.path === 'tasks.json')
  if (!tasksPayload) return []
  try {
    return JSON.parse(tasksPayload.content) as Array<Record<string, unknown>>
  } catch {
    return []
  }
}

export function parsePackageForms(pkg: LocalOfflinePackageRecord) {
  const formsPayload = pkg.payloads.find((p) => p.path === 'forms.json')
  if (!formsPayload) return []
  try {
    return JSON.parse(formsPayload.content) as Array<Record<string, unknown>>
  } catch {
    return []
  }
}
