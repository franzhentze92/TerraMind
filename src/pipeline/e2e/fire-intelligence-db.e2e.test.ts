/**
 * Integración DB opcional — requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY y FIRE_E2E_DB=1.
 * No ejecutar contra producción sin entorno de test dedicado.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FIRE_E2E_DB_PREFIX, FIRE_E2E_IDS } from './fixtures/fire-e2e.constants'
import { runNeedResolution } from '@/pipeline/engines/verification/verification-resolution.runner'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

const DB_ENABLED =
  process.env.FIRE_E2E_DB === '1' &&
  Boolean(process.env.SUPABASE_URL?.trim()) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())

describe.skipIf(!DB_ENABLED)('8B.6A — fire verification DB integration', () => {
  const seededNeedIds: string[] = []

  beforeAll(async () => {
    const supabase = getSupabaseAdmin()

    const { data: incident, error: incError } = await supabase
      .from('incidents')
      .insert({
        id: FIRE_E2E_IDS.incident,
        incident_type: 'fire_situation',
        status: 'open',
        domain: 'fire',
        evidence_status: 'thermal_only',
        first_observed_at: '2026-07-10T11:00:00.000Z',
        last_observed_at: '2026-07-10T11:30:00.000Z',
        attention_score: 72,
        verification_score: 84,
        action_score: 52,
        attention_level: 'high_attention',
        verification_level: 'high_priority',
        action_level: 'prepare',
        metadata: { e2e: FIRE_E2E_DB_PREFIX },
      })
      .select('id')
      .maybeSingle()
    if (incError && incError.code !== '23505') throw new Error(incError.message)
    void incident

    const { data: plan, error: planError } = await supabase
      .from('verification_plans')
      .insert({
        id: FIRE_E2E_IDS.plan,
        incident_id: FIRE_E2E_IDS.incident,
        status: 'in_progress',
        verification_model_version: '1.0.0',
        incident_snapshot: { domain: 'fire', status: 'open' },
        plan_priority: 80,
        plan_reasons: ['E2E seed'],
        plan_limitations: [],
        recommended_window: { end_hours: 48 },
        evidence_requirements: [],
        context_signature: `${FIRE_E2E_DB_PREFIX}plan-v1`,
        mission_candidate_pending: false,
      })
      .select('id')
      .maybeSingle()
    if (planError && planError.code !== '23505') throw new Error(planError.message)
    void plan

    const { data: need, error: needError } = await supabase
      .from('verification_needs')
      .insert({
        id: FIRE_E2E_IDS.need_visual,
        plan_id: FIRE_E2E_IDS.plan,
        need_type: 'obtain_visual_ground_evidence',
        need_question: '¿Existe evidencia visual?',
        priority: 85,
        derivation_reasons: ['E2E seed'],
        evidence_minimum: ['Foto georreferenciada'],
        success_criteria: { text: 'ok' },
        inconclusive_criteria: { text: 'inconcluso' },
        failure_criteria: { text: 'fallo' },
        recommended_window: { hours: 48 },
        recommended_method_id: 'field_visual_inspection',
        alternative_method_ids: [],
        selection_reason: 'E2E',
        resolution_status: 'open',
      })
      .select('id')
      .maybeSingle()
    if (needError && needError.code !== '23505') throw new Error(needError.message)
    seededNeedIds.push(FIRE_E2E_IDS.need_visual)
    void need
  })

  afterAll(async () => {
    if (!DB_ENABLED) return
    const supabase = getSupabaseAdmin()
    await supabase.from('resolution_reevaluation_requests').delete().eq('plan_id', FIRE_E2E_IDS.plan)
    await supabase.from('verification_resolution_evidence_links').delete().in(
      'resolution_id',
      (
        await supabase
          .from('verification_need_resolutions')
          .select('id')
          .eq('verification_need_id', FIRE_E2E_IDS.need_visual)
      ).data?.map((r) => r.id) ?? [],
    )
    await supabase.from('verification_need_resolutions').delete().eq('verification_need_id', FIRE_E2E_IDS.need_visual)
    await supabase.from('verification_resolution_evaluation_runs').delete().eq('verification_need_id', FIRE_E2E_IDS.need_visual)
    await supabase.from('verification_needs').delete().eq('id', FIRE_E2E_IDS.need_visual)
    await supabase.from('verification_plans').delete().eq('id', FIRE_E2E_IDS.plan)
    await supabase.from('incidents').delete().eq('id', FIRE_E2E_IDS.incident)
  })

  it('persists idempotent need resolution evaluation runs', async () => {
    const first = await runNeedResolution(FIRE_E2E_IDS.need_visual, {
      idempotencyKey: `${FIRE_E2E_DB_PREFIX}resolve-1`,
      force: true,
    })
    const second = await runNeedResolution(FIRE_E2E_IDS.need_visual, {
      idempotencyKey: `${FIRE_E2E_DB_PREFIX}resolve-1`,
      force: true,
    })

    expect(first.skipped || first.resolution_id).toBeTruthy()
    expect(second.skipped).toBe(true)

    const supabase = getSupabaseAdmin()
    const { data: runs } = await supabase
      .from('verification_resolution_evaluation_runs')
      .select('id')
      .eq('verification_need_id', FIRE_E2E_IDS.need_visual)
      .eq('idempotency_key', `${FIRE_E2E_DB_PREFIX}resolve-1`)
    expect((runs ?? []).length).toBeLessThanOrEqual(1)
  })
})
