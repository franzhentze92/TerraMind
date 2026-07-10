import { randomUUID } from 'node:crypto'

import {
  FIRE_FIELD_FORM_SCHEMAS,
  schemaForTaskType,
} from '@/modules/field-operations/field-forms/config/fire-field-form.config'
import { buildFieldFormOutput } from '@/modules/field-operations/field-forms/engine/field-form-output'
import {
  assessPackageFormAccess,
  assessSchemaAccess,
} from '@/modules/field-operations/field-forms/engine/package-compatibility'
import {
  createRegistryFromPackage,
  FieldFormSchemaRegistry,
} from '@/modules/field-operations/field-forms/engine/schema-registry'
import { validateFieldFormAnswers } from '@/modules/field-operations/field-forms/engine/field-form-validator'
import type {
  FieldFormResponseRecord,
  FieldFormRevisionSnapshot,
  TaskFormBinding,
} from '@/modules/field-operations/field-forms/field-form.types'
import { FieldFormRepository } from '@/modules/field-operations/field-forms/field-form.repository'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

export interface FieldFormRuntimeContext {
  pkg: LocalOfflinePackageRecord
  registry: FieldFormSchemaRegistry
  repository: FieldFormRepository
  tabId: string
}

export function createFieldFormRuntime(
  pkg: LocalOfflinePackageRecord,
  repository?: FieldFormRepository,
): FieldFormRuntimeContext {
  const formsPayload = pkg.payloads.find((p) => p.path === 'forms.json')
  const embeddedForms = formsPayload ? (JSON.parse(formsPayload.content) as never[]) : []
  const registry = createRegistryFromPackage({
    embeddedForms,
    builtinSchemas: FIRE_FIELD_FORM_SCHEMAS,
  })
  return {
    pkg,
    registry,
    repository: repository ?? FieldFormRepository.createInMemory(),
    tabId: `tab-${randomUUID().slice(0, 8)}`,
  }
}

export function resolveTaskBinding(
  task: Record<string, unknown>,
  registry: FieldFormSchemaRegistry,
): TaskFormBinding | null {
  const taskId = String(task.id)
  const taskType = String(task.task_type)
  const schemaFromTask = task.form_schema_id ? String(task.form_schema_id) : null
  const schemaRecord =
    (schemaFromTask ? registry.getLatest(schemaFromTask) : null) ?? schemaForTaskType(taskType)
  if (!schemaRecord) return null
  return {
    task_id: taskId,
    task_type: taskType,
    schema_id: schemaRecord.schema_id,
    requirement_id: null,
    verification_need_id: null,
  }
}

export async function openTaskForm(
  ctx: FieldFormRuntimeContext,
  task: Record<string, unknown>,
  nowIso: string,
): Promise<{ ok: boolean; reason?: string; response?: FieldFormResponseRecord }> {
  const access = assessPackageFormAccess(ctx.pkg, nowIso)
  if (access.mode === 'blocked') return { ok: false, reason: access.reasons.join(',') }

  const binding = resolveTaskBinding(task, ctx.registry)
  if (!binding) return { ok: false, reason: 'schema_missing' }

  const schema = ctx.registry.get(binding.schema_id, '1.0.0')
  const schemaAccess = assessSchemaAccess(
    ctx.registry,
    schema,
    ctx.pkg.manifest.offline_package_model_version,
  )
  if (!schemaAccess.ok) return { ok: false, reason: schemaAccess.reason }

  let response = await ctx.repository.getActiveResponseForTask(ctx.pkg.package_id, binding.task_id)
  if (!response) {
    const now = nowIso
    response = {
      response_id: randomUUID(),
      package_id: ctx.pkg.package_id,
      package_version: ctx.pkg.package_version,
      mission_id: ctx.pkg.mission_id,
      task_id: binding.task_id,
      requirement_id: binding.requirement_id,
      verification_need_id: binding.verification_need_id,
      schema_id: binding.schema_id,
      schema_version: schema!.schema_version,
      status: 'not_started',
      answers: {},
      validation_errors: [],
      limitations: [],
      created_at: now,
      updated_at: now,
      completed_at: null,
      local_revision: 0,
      context_signature: ctx.pkg.manifest.context_signature,
      supersedes_response_id: null,
      revision_reason: null,
      last_saved_at: null,
      tab_id: ctx.tabId,
    }
    await ctx.repository.saveResponse(response)
  }

  if (response.status === 'locked' || response.status === 'complete') {
    return { ok: true, response }
  }

  if (response.tab_id && response.tab_id !== ctx.tabId && response.status === 'draft') {
    return { ok: false, reason: 'local_tab_conflict' }
  }

  return { ok: true, response }
}

export async function saveDraft(
  ctx: FieldFormRuntimeContext,
  response: FieldFormResponseRecord,
  answers: Record<string, unknown>,
  nowIso: string,
): Promise<FieldFormResponseRecord> {
  const schema = ctx.registry.get(response.schema_id, response.schema_version)
  if (!schema) throw new Error('schema_missing')

  const validation = validateFieldFormAnswers(schema, answers, { finalize: false })
  const sameAnswers = JSON.stringify(response.answers) === JSON.stringify(answers)
  const updated: FieldFormResponseRecord = {
    ...response,
    answers,
    status: sameAnswers && response.status !== 'not_started' ? response.status : 'draft',
    validation_errors: validation.errors,
    limitations: validation.warnings.map((w) => w.message),
    updated_at: nowIso,
    last_saved_at: nowIso,
    tab_id: ctx.tabId,
    local_revision: sameAnswers ? response.local_revision : response.local_revision + 1,
  }
  await ctx.repository.saveResponse(updated)
  return updated
}

export async function finalizeForm(
  ctx: FieldFormRuntimeContext,
  response: FieldFormResponseRecord,
  answers: Record<string, unknown>,
  nowIso: string,
  options: { allowLimitations?: boolean } = {},
): Promise<{ ok: boolean; reason?: string; response?: FieldFormResponseRecord; output?: ReturnType<typeof buildFieldFormOutput> }> {
  if (['locked', 'complete', 'complete_with_limitations'].includes(response.status)) {
    return { ok: true, response, reason: 'already_finalized' }
  }

  const schema = ctx.registry.get(response.schema_id, response.schema_version)
  if (!schema) return { ok: false, reason: 'schema_missing' }

  const validation = validateFieldFormAnswers(schema, answers, { finalize: true })
  if (!validation.valid) return { ok: false, reason: 'validation_failed', response: { ...response, validation_errors: validation.errors, status: 'invalid' } }

  let finalStatus: FieldFormResponseRecord['status'] = 'complete'
  if (validation.warnings.length > 0 || validation.can_complete_with_limitations) {
    if (!options.allowLimitations && !validation.can_complete) {
      return { ok: false, reason: 'warnings_require_explicit_limitations' }
    }
    finalStatus = 'complete_with_limitations'
  }

  const limitations = validation.warnings.map((w) => w.message)
  const output = buildFieldFormOutput({
    response_id: response.response_id,
    mission_id: response.mission_id,
    task_id: response.task_id,
    requirement_id: response.requirement_id,
    schema_id: response.schema_id,
    schema_version: response.schema_version,
    status: finalStatus,
    answers,
    limitations,
    captured_at: nowIso,
    device_location: (answers.device_location as Record<string, unknown>) ?? {},
    package_version: response.package_version,
    package_id: response.package_id,
  })

  const revision: FieldFormRevisionSnapshot = {
    revision_id: randomUUID(),
    response_id: response.response_id,
    local_revision: response.local_revision + 1,
    status: finalStatus,
    answers,
    limitations,
    checksum: output.checksum,
    created_at: nowIso,
    reason: null,
  }

  const finalized: FieldFormResponseRecord = {
    ...response,
    answers,
    status: finalStatus,
    validation_errors: [],
    limitations,
    updated_at: nowIso,
    completed_at: nowIso,
    last_saved_at: nowIso,
    local_revision: response.local_revision + 1,
  }

  await ctx.repository.saveRevision(revision)
  await ctx.repository.saveResponse(finalized)

  return { ok: true, response: finalized, output }
}

export async function createRevision(
  ctx: FieldFormRuntimeContext,
  response: FieldFormResponseRecord,
  reason: string,
  nowIso: string,
): Promise<FieldFormResponseRecord> {
  if (!['complete', 'complete_with_limitations', 'locked'].includes(response.status)) {
    throw new Error('cannot_revise_non_final_response')
  }

  const superseded: FieldFormResponseRecord = {
    ...response,
    status: 'superseded',
    updated_at: nowIso,
  }
  await ctx.repository.saveResponse(superseded)

  const draft: FieldFormResponseRecord = {
    ...response,
    response_id: randomUUID(),
    status: 'draft',
    answers: { ...response.answers },
    validation_errors: [],
    limitations: [],
    created_at: nowIso,
    updated_at: nowIso,
    completed_at: null,
    local_revision: 0,
    supersedes_response_id: response.response_id,
    revision_reason: reason,
    last_saved_at: null,
    tab_id: ctx.tabId,
  }
  await ctx.repository.saveResponse(draft)
  return draft
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null
  return ((...args: never[]) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}
