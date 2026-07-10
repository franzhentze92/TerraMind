import { describe, expect, it } from 'vitest'

import { genericMissionsCoreEngine } from '@/modules/missions/engine/generic-missions.engine'
import { evaluateMissionEligibility } from '@/modules/missions/engine/mission-eligibility.engine'
import {
  assertValidMissionTransition,
  canCompleteMission,
  isValidMissionTransition,
} from '@/modules/missions/engine/mission-state-machine'
import { containsForbiddenMissionCopy } from '@/modules/missions/missions-copy-guard'
import { buildMissionContextSignature } from '@/modules/missions/engine/generic-missions.engine'
import type { MissionPlanSnapshot } from '@/modules/missions/missions.types'

const EVALUATED_AT = '2026-07-10T20:00:00.000Z'

function readyPlan(overrides: Partial<MissionPlanSnapshot> = {}): MissionPlanSnapshot {
  return {
    id: 'plan-1',
    incident_id: 'inc-1',
    status: 'ready',
    plan_priority: 70,
    mission_candidate_pending: true,
    context_signature: 'sig-plan',
    recommended_window: { end_hours: 48 },
    incident_snapshot: {
      domain: 'fire',
      incident_status: 'open',
      centroid_lat: 14.6,
      centroid_lng: -90.5,
      last_observed_at: '2026-07-10T18:00:00.000Z',
    },
    needs: [
      {
        id: 'need-1',
        need_type: 'obtain_visual_ground_evidence',
        need_question: '¿Existe evidencia visual compatible?',
        priority: 75,
        recommended_method_id: 'field_visual_inspection',
        recommended_window: { hours: 48 },
        evidence_minimum: ['Foto georreferenciada'],
        success_criteria: { text: 'Evidencia visual recibida' },
        inconclusive_criteria: { text: 'Visibilidad limitada' },
        failure_criteria: { text: 'Sin acceso' },
      },
    ],
    ...overrides,
  }
}

describe('missions core engine', () => {
  it('does not create mission for not_required plan', () => {
    const result = genericMissionsCoreEngine.evaluate({
      plan: readyPlan({ status: 'not_required', mission_candidate_pending: false }),
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.decision).toBe('not_eligible')
  })

  it('creates mission for ready eligible plan', () => {
    const result = genericMissionsCoreEngine.evaluate({
      plan: readyPlan(),
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.decision).toBe('create_mission')
    expect(result.mission_type).toBe('field_visual_inspection')
    expect(result.tasks.length).toBeGreaterThan(0)
    expect(result.evidence_requirements.length).toBeGreaterThan(0)
  })

  it('does not create mission for blocked plan', () => {
    const result = genericMissionsCoreEngine.evaluate({
      plan: readyPlan({ status: 'blocked' }),
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.decision).toBe('not_eligible')
  })

  it('generates tasks according to method', () => {
    const result = genericMissionsCoreEngine.evaluate({
      plan: readyPlan({
        needs: [
          {
            id: 'need-2',
            need_type: 'confirm_recent_activity',
            need_question: '¿Actividad reciente?',
            priority: 80,
            recommended_method_id: 'review_latest_thermal_detections',
            recommended_window: { hours: 12 },
            evidence_minimum: [],
            success_criteria: { text: 'ok' },
            inconclusive_criteria: { text: 'inconcluso' },
            failure_criteria: { text: 'fallo' },
          },
        ],
      }),
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.mission_type).toBe('remote_analytical_review')
    expect(result.tasks.some((t) => t.task_type === 'perform_review')).toBe(true)
  })

  it('generates evidence requirements according to need template', () => {
    const result = genericMissionsCoreEngine.evaluate({
      plan: readyPlan(),
      evaluatedAt: EVALUATED_AT,
    })
    expect(result.evidence_requirements.some((e) => e.evidence_type === 'georeferenced_photo')).toBe(
      true,
    )
  })

  it('produces same signature for shuffled needs order', () => {
    const planA = readyPlan()
    const planB = readyPlan({
      needs: [...planA.needs].reverse(),
    })
    const sigA = buildMissionContextSignature({
      plan: planA,
      primaryNeedId: 'need-1',
      methodCode: 'field_visual_inspection',
    })
    const sigB = buildMissionContextSignature({
      plan: planB,
      primaryNeedId: 'need-1',
      methodCode: 'field_visual_inspection',
    })
    expect(sigA).toBe(sigB)
  })

  it('rejects invalid mission transition', () => {
    expect(isValidMissionTransition('completed', 'in_progress')).toBe(false)
    expect(() => assertValidMissionTransition('completed', 'in_progress')).toThrow()
  })

  it('allows valid transitions', () => {
    expect(isValidMissionTransition('ready', 'approved')).toBe(true)
    expect(isValidMissionTransition('in_progress', 'inconclusive')).toBe(true)
    expect(isValidMissionTransition('ready', 'expired')).toBe(true)
  })

  it('does not complete mission with required tasks pending', () => {
    const check = canCompleteMission({
      status: 'in_progress',
      requiredTasksPending: 2,
      explicitInconclusive: false,
    })
    expect(check.allowed).toBe(false)
  })

  it('allows inconclusive with explicit reason path', () => {
    const check = canCompleteMission({
      status: 'in_progress',
      requiredTasksPending: 2,
      explicitInconclusive: true,
    })
    expect(check.allowed).toBe(true)
  })

  it('marks blocked method as ineligible', () => {
    const eligibility = evaluateMissionEligibility(
      readyPlan(),
      new Set(['field_visual_inspection']),
    )
    expect(eligibility.eligible).toBe(false)
  })

  it('uses no forbidden copy in outputs', () => {
    const result = genericMissionsCoreEngine.evaluate({
      plan: readyPlan(),
      evaluatedAt: EVALUATED_AT,
    })
    const text = [
      result.title ?? '',
      result.objective ?? '',
      ...result.reasons,
      ...result.limitations,
      ...result.tasks.map((t) => `${t.title} ${t.instructions}`),
    ].join(' ')
    expect(containsForbiddenMissionCopy(text)).toBe(false)
  })
})
