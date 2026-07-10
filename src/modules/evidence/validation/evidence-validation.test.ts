import { describe, expect, it } from 'vitest'

import { evaluateEvidenceValidation, detectConflicts } from '@/modules/evidence/validation/evidence-validation.engine'
import {
  containsForbiddenValidationCopy,
  assertSafeValidationCopy,
} from '@/modules/evidence/validation/evidence-validation-copy-guard'
import { SYNTHETIC_VALIDATION_FIXTURES } from '@/modules/evidence/config/fire-evidence-validation.config'
import type { ValidationSnapshot } from '@/modules/evidence/validation/evidence-validation.types'

function baseSnapshot(overrides: Partial<ValidationSnapshot> = {}): ValidationSnapshot {
  const f = SYNTHETIC_VALIDATION_FIXTURES
  return {
    submission_id: 'sub-test',
    submission_status: 'ready_for_validation',
    evidence_type: 'georeferenced_photo',
    source_type: 'mission_user',
    submitted_by_id: 'user-a',
    submitted_by_type: 'user',
    submitted_at: '2026-07-10T11:00:00.000Z',
    captured_at: f.complete_photo.captured_at,
    device_timestamp: null,
    source_device: 'phone-1',
    source_application: 'terramind-field',
    location_geometry: f.complete_photo.location,
    device_location_geometry: null,
    location_accuracy_m: 15,
    location_outside_mission_area: false,
    location_discrepancy_m: null,
    intake_status: 'ready_for_validation',
    mission: f.mission,
    assets: f.complete_photo.assets,
    observation: null,
    requirement_links: f.requirements,
    peer_submissions: [],
    is_exact_duplicate: false,
    is_superseded: false,
    ...overrides,
  }
}

describe('evidence validation', () => {
  it('accepts technically sound and relevant evidence', () => {
    const result = evaluateEvidenceValidation(baseSnapshot())
    expect(result.status).toBe('accepted')
    expect(result.scores.overall_quality_score).toBeGreaterThanOrEqual(70)
    expect(result.evidence_strength).not.toBe('very_low')
  })

  it('partial metadata produces accepted_with_limitations', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({
        submission_id: 'sub-partial',
        captured_at: null,
        location_geometry: null,
        assets: SYNTHETIC_VALIDATION_FIXTURES.partial_metadata.assets,
      }),
    )
    expect(['accepted_with_limitations', 'inconclusive']).toContain(result.status)
    expect(result.limitations.length).toBeGreaterThan(0)
  })

  it('corrupted asset produces rejected', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({ assets: SYNTHETIC_VALIDATION_FIXTURES.corrupted.assets }),
    )
    expect(result.status).toBe('rejected')
    expect(result.rejection_reason_code).toBe('corrupted_asset')
  })

  it('exact duplicate produces rejected', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({ is_exact_duplicate: true, intake_status: 'duplicate' }),
    )
    expect(result.status).toBe('rejected')
    expect(result.rejection_reason_code).toBe('exact_duplicate')
  })

  it('location outside area does not always reject', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({
        location_geometry: SYNTHETIC_VALIDATION_FIXTURES.outside_area.location,
        location_outside_mission_area: true,
        assets: [
          {
            ...SYNTHETIC_VALIDATION_FIXTURES.complete_photo.assets[0],
            checksum_sha256: 'f'.repeat(64),
          },
        ],
      }),
    )
    expect(result.status).not.toBe('rejected')
    expect(result.limitations.some((l) => l.includes('fuera'))).toBe(true)
  })

  it('timestamp outside window reduces relevance or inconclusive', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({
        captured_at: '2026-07-01T10:00:00.000Z',
        assets: [
          {
            ...SYNTHETIC_VALIDATION_FIXTURES.complete_photo.assets[0],
            checksum_sha256: '1'.repeat(64),
          },
        ],
      }),
    )
    expect(result.scores.temporal_relevance_score).toBeLessThan(50)
    expect(['inconclusive', 'accepted_with_limitations', 'rejected']).toContain(result.status)
  })

  it('irrelevant evidence to requirement is rejected', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({
        evidence_type: 'external_document',
        requirement_links: [
          {
            requirement_id: 'req-photo',
            evidence_type: 'georeferenced_photo',
            match_type: 'not_matched',
            match_score: 0,
          },
        ],
        assets: [
          {
            id: 'doc-1',
            mime_type: 'application/pdf',
            size_bytes: 5000,
            checksum_sha256: '2'.repeat(64),
            upload_confirmed: true,
            mime_extension_mismatch: false,
            width: null,
            height: null,
            duration_seconds: null,
          },
        ],
      }),
    )
    expect(result.status).toBe('rejected')
    expect(result.rejection_reason_code).toBe('irrelevant_to_requirement')
  })

  it('structured observation without file can be accepted', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({
        evidence_type: 'structured_observation',
        assets: [],
        observation: SYNTHETIC_VALIDATION_FIXTURES.negative_observation.observation,
        requirement_links: [
          {
            requirement_id: 'req-obs',
            evidence_type: 'structured_observation',
            match_type: 'matched',
            match_score: 1,
          },
        ],
      }),
    )
    expect(['accepted', 'accepted_with_limitations']).toContain(result.status)
  })

  it('valid negative observation does not resolve incident', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({
        evidence_type: 'structured_observation',
        assets: [],
        observation: SYNTHETIC_VALIDATION_FIXTURES.negative_observation.observation,
        requirement_links: [
          {
            requirement_id: 'req-obs',
            evidence_type: 'structured_observation',
            match_type: 'matched',
            match_score: 1,
          },
        ],
      }),
    )
    expect(result.decision_rules).toContain('negative_observation_not_incident_resolution')
    expect(result.decision_reason).not.toMatch(/confirma|descarta|resuelto/i)
    expect(result.warnings.some((w) => w.includes('no resuelve'))).toBe(true)
  })

  it('same source repeated lowers independence', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({
        peer_submissions: [
          {
            submission_id: 'sub-prev',
            submitted_by_id: 'user-a',
            source_type: 'mission_user',
            source_device: 'phone-1',
            captured_at: '2026-07-10T09:00:00.000Z',
            observation: null,
            validation_status: 'accepted',
          },
        ],
      }),
    )
    expect(result.scores.source_independence_score).toBeLessThan(80)
    expect(result.limitations.some((l) => l.includes('misma fuente'))).toBe(true)
  })

  it('distinct sources increase independence', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({
        peer_submissions: [
          {
            submission_id: 'sub-b',
            submitted_by_id: 'user-b',
            source_type: 'institution',
            source_device: null,
            captured_at: null,
            observation: null,
            validation_status: 'accepted',
          },
          {
            submission_id: 'sub-c',
            submitted_by_id: 'user-c',
            source_type: 'citizen',
            source_device: null,
            captured_at: null,
            observation: null,
            validation_status: 'accepted_with_limitations',
          },
        ],
      }),
    )
    expect(result.checks.some((c) => c.check_code === 'multiple_sources')).toBe(true)
  })

  it('requirement link gets valid coverage without satisfied', () => {
    const result = evaluateEvidenceValidation(baseSnapshot())
    const photoLink = result.requirement_links.find((l) => l.requirement_id === 'req-photo')
    expect(photoLink?.valid_coverage_status).toBe('valid_coverage')
    expect(photoLink?.valid_coverage_status).not.toBe('satisfied')
  })

  it('contradictory observations generate conflict flags', () => {
    const snapshot = baseSnapshot({
      submission_id: 'sub-smoke-yes',
      evidence_type: 'structured_observation',
      assets: [],
      observation: SYNTHETIC_VALIDATION_FIXTURES.smoke_positive.observation,
      peer_submissions: [
        {
          submission_id: 'sub-smoke-no',
          submitted_by_id: 'user-b',
          source_type: 'mission_user',
          source_device: null,
          captured_at: '2026-07-10T10:30:00.000Z',
          observation: SYNTHETIC_VALIDATION_FIXTURES.smoke_negative.observation,
          validation_status: 'accepted',
        },
      ],
    })
    const flags = detectConflicts(snapshot)
    expect(flags.length).toBeGreaterThan(0)
    const result = evaluateEvidenceValidation(snapshot)
    expect(result.conflict_flags.length).toBeGreaterThan(0)
    expect(result.status).not.toBe('rejected')
  })

  it('same input produces same decision', () => {
    const snap = baseSnapshot({
      assets: [
        {
          ...SYNTHETIC_VALIDATION_FIXTURES.complete_photo.assets[0],
          checksum_sha256: '3'.repeat(64),
        },
      ],
    })
    const a = evaluateEvidenceValidation(snap)
    const b = evaluateEvidenceValidation(snap)
    expect(a.status).toBe(b.status)
    expect(a.context_signature).toBe(b.context_signature)
    expect(a.scores).toEqual(b.scores)
  })

  it('withdrawn submission not accepted', () => {
    const result = evaluateEvidenceValidation(
      baseSnapshot({ submission_status: 'withdrawn', intake_status: 'withdrawn' }),
    )
    expect(result.status).toBe('rejected')
    expect(result.rejection_reason_code).toBe('withdrawn_by_submitter')
  })

  it('rejects forbidden copy', () => {
    expect(containsForbiddenValidationCopy('confirma incendio')).toBe(true)
    expect(() => assertSafeValidationCopy('falso positivo confirmado')).toThrow()
    expect(containsForbiddenValidationCopy('evidencia aceptada')).toBe(false)
    expect(containsForbiddenValidationCopy('fuerza probatoria moderada')).toBe(false)
  })

  it('outputs avoid prohibited copy', () => {
    const result = evaluateEvidenceValidation(baseSnapshot())
    const text = JSON.stringify(result)
    expect(containsForbiddenValidationCopy(text)).toBe(false)
  })
})
