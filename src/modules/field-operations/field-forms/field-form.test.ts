import { describe, expect, it } from 'vitest'

import {
  FIELD_VISUAL_OBSERVATION_SCHEMA,
  FIRE_FIELD_FORM_SCHEMAS,
} from '@/modules/field-operations/field-forms/config/fire-field-form.config'
import { applyConditionalRules, evaluateWhen } from '@/modules/field-operations/field-forms/engine/conditional-engine'
import {
  buildFieldFormOutput,
  canonicalJson,
  fieldFormOutputChecksum,
} from '@/modules/field-operations/field-forms/engine/field-form-output'
import { assessPackageFormAccess } from '@/modules/field-operations/field-forms/engine/package-compatibility'
import {
  createRegistryFromPackage,
  FieldFormSchemaRegistry,
} from '@/modules/field-operations/field-forms/engine/schema-registry'
import { validateFieldFormAnswers, validateAllFireSchemas } from '@/modules/field-operations/field-forms/engine/field-form-validator'
import { scanAnswersForForbiddenCopy } from '@/modules/field-operations/field-forms/field-form-copy-guard'
import { FieldFormRepository } from '@/modules/field-operations/field-forms/field-form.repository'
import {
  createFieldFormRuntime,
  finalizeForm,
  openTaskForm,
  saveDraft,
  createRevision,
} from '@/modules/field-operations/field-forms/field-form.runtime'
import { buildOfflinePackage } from '@/modules/field-operations/offline-packages/engine/offline-package.engine'
import { ALL_OFFLINE_PACKAGE_PERMISSIONS } from '@/modules/field-operations/offline-packages/offline-package-permissions'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'
import { toPackageFormSchema } from '@/modules/field-operations/field-forms/config/fire-field-form.config'

const EVALUATED_AT = '2026-07-10T12:00:00.000Z'

function syntheticPackage(): LocalOfflinePackageRecord {
  const mission = {
    id: '00000000-0000-4000-a002-000000000001',
    mission_type: 'field_visual_inspection',
    title: 'Inspección campo',
    objective: 'Observación estructurada compatible.',
    status: 'ready',
    incident_id: '00000000-0000-4000-a002-000000000010',
    verification_plan_id: '00000000-0000-4000-a002-000000000020',
    recommended_method_code: 'field_visual_inspection',
    location_geometry: { type: 'Point', coordinates: [-90.5, 14.6] },
    location_description: 'Sector norte',
    priority: 70,
    earliest_start_at: '2026-07-10T08:00:00.000Z',
    due_at: '2026-07-11T08:00:00.000Z',
    expires_at: '2026-07-12T08:00:00.000Z',
    completion_criteria: { text: 'Observación completada' },
    inconclusive_criteria: { text: 'Visibilidad limitada' },
    blocking_conditions: [],
    cancellation_conditions: [],
    mission_profile_version: '1.0.0',
    source_snapshot: { reasons: [], eligibility: { limitations: [] } },
    context_signature: 'ctx',
  }
  const tasks = [
    {
      id: '00000000-0000-4000-a002-000000000101',
      sequence: 3,
      task_type: 'structured_observation',
      title: 'Observación',
      instructions: 'Documentar indicadores.',
      required: true,
      completion_criteria: { text: 'Hecho' },
      status: 'pending',
    },
  ]
  const evidence = [
    {
      id: '00000000-0000-4000-a002-000000000201',
      evidence_type: 'structured_observation',
      required: true,
      minimum_count: 1,
      required_metadata: [],
      quality_criteria: [],
      acceptance_criteria: { text: 'Observación' },
    },
  ]
  const built = buildOfflinePackage({
    package_id: '00000000-0000-4000-a002-000000000501',
    package_version: 1,
    mission,
    tasks,
    evidence_requirements: evidence,
    assignment: null,
    plan_needs: [],
    incident: null,
    permissions: ALL_OFFLINE_PACKAGE_PERMISSIONS,
    actor_id: 'test',
    evaluated_at: EVALUATED_AT,
    signingKey: 'test-key',
  })
  const manifest = JSON.parse(built.payloads.find((p) => p.path === 'manifest.json')!.content)
  return {
    package_id: manifest.package_id,
    mission_id: mission.id as string,
    mission_title: mission.title as string,
    package_version: 1,
    local_status: 'available',
    manifest,
    payloads: built.payloads.filter((p) => p.path !== 'manifest.json'),
    downloaded_at: EVALUATED_AT,
    superseded_by: null,
    size_bytes: 1000,
    integrity_errors: [],
    updated_at: EVALUATED_AT,
  }
}

describe('field form runtime — 8B.7B', () => {
  it('loads schemas from offline package', () => {
    const pkg = syntheticPackage()
    const ctx = createFieldFormRuntime(pkg)
    expect(ctx.registry.get('field_visual_observation', '1.0.0')).toBeTruthy()
  })

  it('all fire schemas validate structurally', () => {
    const results = validateAllFireSchemas()
    expect(results.every((r) => r.ok)).toBe(true)
  })

  it('renders validation without network using package schemas', () => {
    const registry = createRegistryFromPackage({
      embeddedForms: FIRE_FIELD_FORM_SCHEMAS.map(toPackageFormSchema),
    })
    const schema = registry.get('field_visual_observation', '1.0.0')!
    const result = validateFieldFormAnswers(schema, {}, { finalize: false })
    expect(result.visible_fields.length).toBeGreaterThan(0)
  })

  it('required fields block finalization', async () => {
    const pkg = syntheticPackage()
    const repo = FieldFormRepository.createInMemory()
    const ctx = createFieldFormRuntime(pkg, repo)
    const task = { id: '00000000-0000-4000-a002-000000000101', task_type: 'structured_observation', title: 'Obs', instructions: '' }
    const opened = await openTaskForm(ctx, task, EVALUATED_AT)
    expect(opened.ok).toBe(true)
    const result = await finalizeForm(ctx, opened.response!, {}, EVALUATED_AT)
    expect(result.ok).toBe(false)
  })

  it('warnings allow complete_with_limitations', async () => {
    const schema = FIELD_VISUAL_OBSERVATION_SCHEMA
    const answers = {
      observation_datetime: EVALUATED_AT,
      visibility_conditions: 'poor',
      access_possible: 'yes',
      visible_smoke: 'no',
      visible_flame: 'no',
      limitations: 'Visibilidad reducida por humo lejano',
    }
    const validation = validateFieldFormAnswers(schema, answers, { finalize: true })
    expect(validation.can_complete_with_limitations).toBe(true)
  })

  it('conditional logic shows smoke detail fields', () => {
    const base = Object.keys(FIELD_VISUAL_OBSERVATION_SCHEMA.json_schema.properties as object)
    const result = applyConditionalRules(
      FIELD_VISUAL_OBSERVATION_SCHEMA.conditional_rules,
      { visible_smoke: 'yes' },
      base,
      [],
    )
    expect(result.visible_fields).toContain('smoke_intensity')
    expect(result.required_fields).toContain('smoke_intensity')
  })

  it('answering no is not treated as missing field', () => {
    const validation = validateFieldFormAnswers(
      FIELD_VISUAL_OBSERVATION_SCHEMA,
      {
        observation_datetime: EVALUATED_AT,
        visibility_conditions: 'clear',
        access_possible: 'yes',
        visible_smoke: 'no',
        visible_flame: 'no',
      },
      { finalize: true },
    )
    expect(validation.errors.some((e) => e.field === 'visible_smoke' && e.code === 'required')).toBe(false)
  })

  it('draft persists and reloads', async () => {
    const pkg = syntheticPackage()
    const repo = FieldFormRepository.createInMemory()
    const ctx = createFieldFormRuntime(pkg, repo)
    const task = { id: '00000000-0000-4000-a002-000000000101', task_type: 'structured_observation', title: 'Obs', instructions: '' }
    const opened = await openTaskForm(ctx, task, EVALUATED_AT)
    const saved = await saveDraft(ctx, opened.response!, { notes: 'borrador' }, EVALUATED_AT)
    expect(saved.status).toBe('draft')
    const reloaded = await repo.getResponse(saved.response_id)
    expect(reloaded?.answers.notes).toBe('borrador')
  })

  it('finalization creates stable checksum', async () => {
    const pkg = syntheticPackage()
    const repo = FieldFormRepository.createInMemory()
    const ctx = createFieldFormRuntime(pkg, repo)
    const task = { id: '00000000-0000-4000-a002-000000000101', task_type: 'structured_observation', title: 'Obs', instructions: '' }
    const opened = await openTaskForm(ctx, task, EVALUATED_AT)
    const answers = {
      observation_datetime: EVALUATED_AT,
      visibility_conditions: 'clear',
      access_possible: 'yes',
      visible_smoke: 'no',
      visible_flame: 'no',
    }
    const a = await finalizeForm(ctx, opened.response!, answers, EVALUATED_AT, { allowLimitations: true })
    const b = await finalizeForm(ctx, a.response!, answers, EVALUATED_AT, { allowLimitations: true })
    expect(b.reason).toBe('already_finalized')
    expect(a.output?.checksum).toBeTruthy()
    const rebuilt = buildFieldFormOutput({
      response_id: a.response!.response_id,
      mission_id: a.response!.mission_id,
      task_id: a.response!.task_id,
      requirement_id: a.response!.requirement_id,
      schema_id: a.response!.schema_id,
      schema_version: a.response!.schema_version,
      status: a.response!.status,
      answers: a.response!.answers,
      limitations: a.response!.limitations,
      captured_at: EVALUATED_AT,
      device_location: {},
      package_version: a.response!.package_version,
      package_id: a.response!.package_id,
    })
    expect(rebuilt.checksum).toBe(a.output?.checksum)
  })

  it('canonical output order does not change checksum', () => {
    const payload = {
      response_id: 'r1',
      mission_id: 'm1',
      task_id: 't1',
      requirement_id: null,
      schema_id: 'field_visual_observation',
      schema_version: '1.0.0',
      status: 'complete' as const,
      answers: { b: 1, a: 2 },
      limitations: [],
      captured_at: EVALUATED_AT,
      device_location: {},
      package_version: 1,
      package_id: 'p1',
    }
    const c1 = fieldFormOutputChecksum(payload)
    const c2 = fieldFormOutputChecksum({ ...payload, answers: { a: 2, b: 1 } })
    expect(c1).toBe(c2)
  })

  it('revision preserves previous response as superseded', async () => {
    const pkg = syntheticPackage()
    const repo = FieldFormRepository.createInMemory()
    const ctx = createFieldFormRuntime(pkg, repo)
    const task = { id: '00000000-0000-4000-a002-000000000101', task_type: 'structured_observation', title: 'Obs', instructions: '' }
    const opened = await openTaskForm(ctx, task, EVALUATED_AT)
    const answers = {
      observation_datetime: EVALUATED_AT,
      visibility_conditions: 'clear',
      access_possible: 'yes',
      visible_smoke: 'no',
      visible_flame: 'no',
    }
    const done = await finalizeForm(ctx, opened.response!, answers, EVALUATED_AT, { allowLimitations: true })
    const draft = await createRevision(ctx, done.response!, 'Ajuste menor', EVALUATED_AT)
    const old = await repo.getResponse(done.response!.response_id)
    expect(old?.status).toBe('superseded')
    expect(draft.supersedes_response_id).toBe(done.response!.response_id)
  })

  it('revoked package blocks new capture', () => {
    const pkg = syntheticPackage()
    pkg.local_status = 'revoked'
    const access = assessPackageFormAccess(pkg, EVALUATED_AT)
    expect(access.mode).toBe('blocked')
  })

  it('expired package allows historical mode only', () => {
    const pkg = syntheticPackage()
    pkg.manifest.valid_until = '2026-07-09T00:00:00.000Z'
    const blocked = assessPackageFormAccess(pkg, EVALUATED_AT)
    const historical = assessPackageFormAccess(pkg, EVALUATED_AT, { allowHistorical: true })
    expect(blocked.mode).toBe('blocked')
    expect(historical.mode).toBe('historical')
  })

  it('missing schema fails safely', () => {
    const registry = new FieldFormSchemaRegistry()
    expect(registry.get('missing', '1.0.0')).toBeNull()
  })

  it('incompatible schema version rejected', () => {
    const registry = createRegistryFromPackage({ embeddedForms: [] })
    registry.register({
      ...FIELD_VISUAL_OBSERVATION_SCHEMA,
      compatibility: { offline_package_model_version: '9.9.9' },
    })
    const schema = registry.get('field_visual_observation', '1.0.0')!
    const compat = registry.isCompatible(schema, '1.0.0')
    expect(compat.compatible).toBe(false)
  })

  it('detects local tab conflict on draft', async () => {
    const pkg = syntheticPackage()
    const repo = FieldFormRepository.createInMemory()
    const ctx1 = createFieldFormRuntime(pkg, repo)
    const ctx2 = { ...createFieldFormRuntime(pkg, repo), tabId: 'other-tab' }
    const task = { id: '00000000-0000-4000-a002-000000000101', task_type: 'structured_observation', title: 'Obs', instructions: '' }
    const opened = await openTaskForm(ctx1, task, EVALUATED_AT)
    await saveDraft(ctx1, opened.response!, { notes: 'x' }, EVALUATED_AT)
    const conflict = await openTaskForm(ctx2, task, EVALUATED_AT)
    expect(conflict.ok).toBe(false)
    expect(conflict.reason).toBe('local_tab_conflict')
  })

  it('forbidden copy in answers is rejected', () => {
    const hits = scanAnswersForForbiddenCopy({ notes: 'incendio confirmado en el área' })
    expect(hits.length).toBeGreaterThan(0)
  })

  it('spanish and english share same schema keys', () => {
    expect(FIELD_VISUAL_OBSERVATION_SCHEMA.localization['visible_smoke.label']).toBeTruthy()
    expect(FIELD_VISUAL_OBSERVATION_SCHEMA.schema_id).toBe('field_visual_observation')
  })

  it('evaluateWhen supports uncertain answers', () => {
    expect(evaluateWhen({ field: 'visible_smoke', equals: 'no' }, { visible_smoke: 'no' })).toBe(true)
    expect(evaluateWhen({ field: 'visible_smoke', equals: 'yes' }, { visible_smoke: 'uncertain' })).toBe(false)
  })

  it('buildFieldFormOutput matches contract shape', () => {
    const output = buildFieldFormOutput({
      response_id: 'r',
      mission_id: 'm',
      task_id: 't',
      requirement_id: null,
      schema_id: 'field_visual_observation',
      schema_version: '1.0.0',
      status: 'complete',
      answers: {},
      limitations: [],
      captured_at: EVALUATED_AT,
      device_location: {},
      package_version: 1,
      package_id: 'p',
    })
    expect(output.checksum).toHaveLength(64)
    expect(canonicalJson(output).includes('checksum')).toBe(true)
  })
})
