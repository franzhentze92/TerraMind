import { describe, expect, it } from 'vitest'

import { evaluateAssetIntegrity } from '@/modules/evidence/engine/evidence-integrity.engine'
import { evaluateDeduplication } from '@/modules/evidence/engine/evidence-deduplication.engine'
import {
  evaluateRequirementLinks,
  computeEvidenceCoverage,
} from '@/modules/evidence/engine/evidence-requirement-matching.engine'
import {
  evaluateEvidenceProcessing,
  evaluateLocationContext,
  detectMissingMetadata,
} from '@/modules/evidence/engine/evidence-intake-processing.engine'
import {
  evaluateCreateSubmission,
  evaluateConfirmUpload,
  evaluateWithdrawSubmission,
} from '@/modules/evidence/engine/evidence-intake.engine'
import { assertEvidencePermission } from '@/modules/evidence/evidence-permissions'
import {
  containsForbiddenEvidenceCopy,
  assertSafeEvidenceCopy,
} from '@/modules/evidence/evidence-intake-copy-guard'
import {
  ALL_EVIDENCE_PERMISSIONS,
  SYNTHETIC_EVIDENCE_FIXTURES,
} from '@/modules/evidence/config/fire-evidence-intake.config'

const NOW = '2026-07-10T20:00:00.000Z'
const actor = { actor_type: 'user' as const, actor_id: 'fixture-user', permissions: ALL_EVIDENCE_PERMISSIONS }

describe('evidence intake', () => {
  it('authorized user can create submission', () => {
    const result = evaluateCreateSubmission({
      command: {
        mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
        source_type: 'mission_user',
        evidence_type: 'georeferenced_photo',
        actor,
      },
      mission_status: 'in_progress',
      mission_cancelled: false,
    })
    expect(result.ok).toBe(true)
    expect(result.submission_status).toBe('received')
  })

  it('rejects user without permission', () => {
    expect(() =>
      assertEvidencePermission(['evidence.view'], 'create_submission'),
    ).toThrow()
  })

  it('rejects submission on cancelled mission', () => {
    const result = evaluateCreateSubmission({
      command: {
        mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
        source_type: 'mission_user',
        evidence_type: 'georeferenced_photo',
        actor,
      },
      mission_status: 'cancelled',
      mission_cancelled: true,
    })
    expect(result.ok).toBe(false)
  })

  it('confirmed asset generates checksum validation', () => {
    const integrity = evaluateAssetIntegrity({
      evidence_type: 'georeferenced_photo',
      ...SYNTHETIC_EVIDENCE_FIXTURES.photo_asset,
    })
    expect(integrity.valid).toBe(true)
    expect(integrity.checksum_valid).toBe(true)
  })

  it('repeated file marked duplicate', () => {
    const dedup = evaluateDeduplication({
      mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
      submitted_by_id: 'fixture-user',
      checksum_sha256: SYNTHETIC_EVIDENCE_FIXTURES.duplicate_checksum,
      original_filename: 'campo_001.jpg',
      submitted_at: NOW,
      existing_assets: [
        {
          submission_id: 'sub-old',
          asset_id: 'asset-old',
          checksum_sha256: SYNTHETIC_EVIDENCE_FIXTURES.duplicate_checksum,
          mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
          submitted_by_id: 'fixture-user',
          submitted_at: '2026-07-10T19:00:00.000Z',
          original_filename: 'campo_001.jpg',
        },
      ],
    })
    expect(dedup.duplicate_class).toBe('exact_duplicate')
  })

  it('flags extension and mime mismatch', () => {
    const integrity = evaluateAssetIntegrity({
      evidence_type: 'georeferenced_photo',
      original_filename: 'foto.png',
      mime_type: 'image/jpeg',
      size_bytes: 1024,
      checksum_sha256: 'a'.repeat(64),
    })
    expect(integrity.extension_mismatch).toBe(true)
  })

  it('missing metadata produces incomplete not hard reject', () => {
    const missing = detectMissingMetadata({
      evidence_type: 'georeferenced_photo',
      captured_at: null,
      location_geometry: null,
      has_observation: false,
      has_assets: true,
    })
    expect(missing).toContain('captured_at')
    expect(missing).toContain('location')

    const processed = evaluateEvidenceProcessing({
      submission_id: 'sub-1',
      mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
      submitted_by_id: 'fixture-user',
      submitted_at: NOW,
      evidence_type: 'georeferenced_photo',
      mission_area: SYNTHETIC_EVIDENCE_FIXTURES.mission.location_geometry,
      requirements: SYNTHETIC_EVIDENCE_FIXTURES.requirements,
      assets: [SYNTHETIC_EVIDENCE_FIXTURES.photo_asset],
      has_observation: false,
      existing_assets: [],
    })
    expect(processed.submission_status).toBe('incomplete')
    expect(processed.ok).toBe(true)
  })

  it('structured observation can exist without file', () => {
    const processed = evaluateEvidenceProcessing({
      submission_id: 'sub-obs',
      mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
      submitted_by_id: 'fixture-user',
      submitted_at: NOW,
      evidence_type: 'structured_observation',
      mission_area: SYNTHETIC_EVIDENCE_FIXTURES.mission.location_geometry,
      requirements: SYNTHETIC_EVIDENCE_FIXTURES.requirements,
      assets: [],
      has_observation: true,
      existing_assets: [],
    })
    expect(processed.ok).toBe(true)
    expect(processed.submission_status).not.toBe('unsupported')
  })

  it('location outside area preserved and flagged', () => {
    const loc = evaluateLocationContext({
      declared_location: SYNTHETIC_EVIDENCE_FIXTURES.outside_location,
      device_location: null,
      mission_area: SYNTHETIC_EVIDENCE_FIXTURES.mission.location_geometry,
    })
    expect(loc.outside_mission_area).toBe(true)
    expect(loc.warnings.length).toBeGreaterThan(0)

    const processed = evaluateEvidenceProcessing({
      submission_id: 'sub-out',
      mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
      submitted_by_id: 'fixture-user',
      submitted_at: NOW,
      evidence_type: 'georeferenced_photo',
      location_geometry: SYNTHETIC_EVIDENCE_FIXTURES.outside_location,
      mission_area: SYNTHETIC_EVIDENCE_FIXTURES.mission.location_geometry,
      requirements: SYNTHETIC_EVIDENCE_FIXTURES.requirements,
      assets: [
        {
          ...SYNTHETIC_EVIDENCE_FIXTURES.photo_asset,
          checksum_sha256: 'b'.repeat(64),
        },
      ],
      has_observation: false,
      existing_assets: [],
      captured_at: NOW,
    })
    expect(processed.location_outside_mission_area).toBe(true)
    expect(processed.ok).toBe(true)
  })

  it('captured_at and submitted_at remain separate concepts', () => {
    const processed = evaluateEvidenceProcessing({
      submission_id: 'sub-time',
      mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
      submitted_by_id: 'fixture-user',
      submitted_at: NOW,
      evidence_type: 'georeferenced_photo',
      captured_at: '2026-07-09T10:00:00.000Z',
      location_geometry: SYNTHETIC_EVIDENCE_FIXTURES.inside_location,
      mission_area: SYNTHETIC_EVIDENCE_FIXTURES.mission.location_geometry,
      requirements: SYNTHETIC_EVIDENCE_FIXTURES.requirements,
      assets: [
        {
          ...SYNTHETIC_EVIDENCE_FIXTURES.photo_asset,
          checksum_sha256: 'c'.repeat(64),
        },
      ],
      has_observation: false,
      existing_assets: [],
    })
    expect(processed.ok).toBe(true)
    expect(processed.submission_status).toBe('ready_for_validation')
  })

  it('submission can cover multiple requirements preliminarily', () => {
    const links = evaluateRequirementLinks({
      evidence_type: 'georeferenced_photo',
      requirements: SYNTHETIC_EVIDENCE_FIXTURES.requirements,
      has_assets: true,
      has_observation: false,
      missing_metadata: [],
    })
    expect(links.length).toBe(2)
    expect(links.some((l) => l.match_type === 'matched')).toBe(true)
    expect(links.some((l) => l.match_type === 'not_matched')).toBe(true)
  })

  it('requirement not marked satisfied during intake', () => {
    const coverage = computeEvidenceCoverage({
      mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
      requirements: SYNTHETIC_EVIDENCE_FIXTURES.requirements,
      submissions: [
        {
          id: 'sub-1',
          status: 'ready_for_validation',
          evidence_type: 'georeferenced_photo',
          linked_requirement_ids: ['fixture-req-photo'],
        },
      ],
      now_iso: NOW,
    })
    const photoReq = coverage.requirements.find((r) => r.requirement_id === 'fixture-req-photo')
    expect(photoReq?.preliminary_status).toBe('ready_for_validation')
    expect(photoReq?.preliminary_status).not.toBe('satisfied')
  })

  it('confirm upload idempotency detected', () => {
    const result = evaluateConfirmUpload({
      evidence_type: 'georeferenced_photo',
      asset_count: 1,
      mime_type: 'image/jpeg',
      permissions: ALL_EVIDENCE_PERMISSIONS,
      idempotency_key: 'key-1',
      existing_asset_idempotency: true,
    })
    expect(result.idempotent_replay).toBe(true)
  })

  it('withdraw preserves audit intent', () => {
    const result = evaluateWithdrawSubmission({
      submission_status: 'incomplete',
      submitted_by_id: 'fixture-user',
      actor_id: 'fixture-user',
      permissions: ALL_EVIDENCE_PERMISSIONS,
      reason: 'Archivo incorrecto',
    })
    expect(result.ok).toBe(true)
    expect(result.submission_status).toBe('withdrawn')
    expect(result.reasons[0]).toContain('auditoría')
  })

  it('same input and version produces same processing outcome', () => {
    const input = {
      submission_id: 'sub-det',
      mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
      submitted_by_id: 'fixture-user',
      submitted_at: NOW,
      evidence_type: 'georeferenced_photo' as const,
      captured_at: NOW,
      location_geometry: SYNTHETIC_EVIDENCE_FIXTURES.inside_location,
      mission_area: SYNTHETIC_EVIDENCE_FIXTURES.mission.location_geometry,
      requirements: SYNTHETIC_EVIDENCE_FIXTURES.requirements,
      assets: [
        {
          ...SYNTHETIC_EVIDENCE_FIXTURES.photo_asset,
          checksum_sha256: 'd'.repeat(64),
        },
      ],
      has_observation: false,
      existing_assets: [] as never[],
    }
    const a = evaluateEvidenceProcessing(input)
    const b = evaluateEvidenceProcessing(input)
    expect(a.submission_status).toBe(b.submission_status)
    expect(a.requirement_links).toEqual(b.requirement_links)
  })

  it('rejects forbidden copy', () => {
    expect(containsForbiddenEvidenceCopy('evidencia confirma incendio')).toBe(true)
    expect(() => assertSafeEvidenceCopy('incendio verificado')).toThrow()
    expect(containsForbiddenEvidenceCopy('evidencia recibida')).toBe(false)
    expect(containsForbiddenEvidenceCopy('lista para validación')).toBe(false)
  })

  it('processing warns that intake does not validate evidence', () => {
    const processed = evaluateEvidenceProcessing({
      submission_id: 'sub-warn',
      mission_id: SYNTHETIC_EVIDENCE_FIXTURES.mission.id,
      submitted_by_id: 'fixture-user',
      submitted_at: NOW,
      evidence_type: 'georeferenced_photo',
      captured_at: NOW,
      location_geometry: SYNTHETIC_EVIDENCE_FIXTURES.inside_location,
      mission_area: SYNTHETIC_EVIDENCE_FIXTURES.mission.location_geometry,
      requirements: SYNTHETIC_EVIDENCE_FIXTURES.requirements,
      assets: [
        {
          ...SYNTHETIC_EVIDENCE_FIXTURES.photo_asset,
          checksum_sha256: 'e'.repeat(64),
        },
      ],
      has_observation: false,
      existing_assets: [],
    })
    expect(processed.warnings.some((w) => w.includes('no valida evidencia'))).toBe(true)
    expect(processed.reasons.some((r) => r.includes('confirma'))).toBe(false)
  })
})
