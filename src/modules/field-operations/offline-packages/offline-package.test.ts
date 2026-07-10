import { describe, expect, it } from 'vitest'

import { verifyManifestIntegrity, canonicalJson, sha256Hex } from '@/modules/field-operations/offline-packages/offline-package-canonical'
import { containsForbiddenOfflinePackageCopy } from '@/modules/field-operations/offline-packages/offline-package-copy-guard'
import {
  buildOfflinePackage,
  buildOfflinePackageContextSignature,
  evaluateOfflinePackageEligibility,
  nextPackageVersion,
} from '@/modules/field-operations/offline-packages/engine/offline-package.engine'
import {
  OfflinePackageRepository,
  canOpenLocalPackage,
  canStartFieldExecution,
} from '@/modules/field-operations/offline-packages/offline-package.repository'
import { ALL_OFFLINE_PACKAGE_PERMISSIONS } from '@/modules/field-operations/offline-packages/offline-package-permissions'

const EVALUATED_AT = '2026-07-10T12:00:00.000Z'
const SIGNING_KEY = 'test-signing-key'

function baseMission(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-a001-000000000001',
    mission_type: 'field_visual_inspection',
    domain: 'fire',
    title: 'Inspección visual — área protegida',
    objective: 'Obtener observación estructurada compatible con la necesidad de verificación.',
    status: 'ready',
    incident_id: '00000000-0000-4000-a001-000000000010',
    verification_plan_id: '00000000-0000-4000-a001-000000000020',
    primary_verification_need_id: '00000000-0000-4000-a001-000000000030',
    recommended_method_code: 'field_visual_inspection',
    location_geometry: {
      type: 'Point',
      coordinates: [-90.5069, 14.6349],
    },
    location_description: 'Bosque protegido, sector norte',
    priority: 72,
    earliest_start_at: '2026-07-10T10:00:00.000Z',
    due_at: '2026-07-11T10:00:00.000Z',
    expires_at: '2026-07-12T10:00:00.000Z',
    completion_criteria: { text: 'Observación estructurada completada' },
    inconclusive_criteria: { text: 'Visibilidad limitada' },
    blocking_conditions: [],
    cancellation_conditions: [],
    mission_profile_version: '1.0.0',
    source_snapshot: { reasons: ['Necesidad de evidencia visual'], eligibility: { limitations: [] } },
    context_signature: 'mission-sig',
    reporter_identity: 'must-be-redacted',
    ...overrides,
  }
}

const baseTasks = [
  {
    id: '00000000-0000-4000-a001-000000000101',
    mission_id: '00000000-0000-4000-a001-000000000001',
    task_type: 'navigate_to_area',
    sequence: 1,
    title: 'Llegar al área',
    instructions: 'Desplazarse al punto seguro.',
    status: 'pending',
    required: true,
    completion_criteria: { text: 'Posición registrada' },
  },
  {
    id: '00000000-0000-4000-a001-000000000102',
    mission_id: '00000000-0000-4000-a001-000000000001',
    task_type: 'structured_observation',
    sequence: 2,
    title: 'Observación',
    instructions: 'Documentar indicadores visibles.',
    status: 'pending',
    required: true,
    completion_criteria: { text: 'Observación completada' },
  },
]

const baseEvidence = [
  {
    id: '00000000-0000-4000-a001-000000000201',
    mission_id: '00000000-0000-4000-a001-000000000001',
    verification_need_id: '00000000-0000-4000-a001-000000000030',
    evidence_type: 'georeferenced_photo',
    required: true,
    minimum_count: 1,
    required_metadata: ['lat', 'lon', 'timestamp'],
    quality_criteria: ['Imagen nítida'],
    acceptance_criteria: { text: 'Foto georreferenciada mínima' },
  },
]

const planNeeds = [
  {
    id: '00000000-0000-4000-a001-000000000030',
    need_type: 'obtain_visual_ground_evidence',
    need_question: '¿Existe evidencia visual compatible?',
    priority: 75,
    recommended_method_id: 'field_visual_inspection',
  },
]

function buildInput(overrides: Partial<Parameters<typeof buildOfflinePackage>[0]> = {}) {
  return {
    package_id: '00000000-0000-4000-a001-000000000501',
    package_version: 1,
    mission: baseMission(),
    tasks: baseTasks,
    evidence_requirements: baseEvidence,
    assignment: null,
    plan_needs: planNeeds,
    incident: { id: '00000000-0000-4000-a001-000000000010', status: 'open' },
    permissions: ALL_OFFLINE_PACKAGE_PERMISSIONS,
    actor_id: 'test-user',
    evaluated_at: EVALUATED_AT,
    signingKey: SIGNING_KEY,
    ...overrides,
  }
}

describe('offline package engine — 8B.7A', () => {
  it('eligible mission generates package with mission, tasks, requirements, geometry and forms', () => {
    const result = buildOfflinePackage(buildInput())
    expect(result.decision).toBe('generate_package')
    expect(result.snapshot.mission.mission_id).toBe(baseMission().id)
    expect(result.snapshot.tasks.length).toBe(2)
    expect(result.snapshot.evidence_requirements.length).toBe(1)
    expect(result.snapshot.location.geometry).toBeTruthy()
    expect(result.snapshot.forms.length).toBeGreaterThan(0)
    expect(result.payloads.some((p) => p.path === 'manifest.json')).toBe(true)
  })

  it('draft mission does not generate package', () => {
    const result = buildOfflinePackage(buildInput({ mission: baseMission({ status: 'draft' }) }))
    expect(result.decision).toBe('not_eligible')
    expect(result.reasons).toContain('mission_status_draft')
  })

  it('cancelled mission does not generate operative package', () => {
    const result = buildOfflinePackage(buildInput({ mission: baseMission({ status: 'cancelled' }) }))
    expect(result.decision).toBe('not_eligible')
  })

  it('expired mission does not generate operative package', () => {
    const result = buildOfflinePackage(
      buildInput({
        mission: baseMission({
          status: 'ready',
          expires_at: '2026-07-09T10:00:00.000Z',
        }),
      }),
    )
    expect(result.decision).toBe('not_eligible')
    expect(result.reasons).toContain('mission_expired')
  })

  it('redacts sensitive fields when view_sensitive permission is absent', () => {
    const result = buildOfflinePackage(
      buildInput({ permissions: ['offline_packages.generate', 'offline_packages.download'] }),
    )
    expect(result.redaction.excluded_fields).toContain('mission.reporter_identity')
    expect(JSON.stringify(result.payloads)).not.toContain('must-be-redacted')
  })

  it('manifest is deterministic for same input', () => {
    const a = buildOfflinePackage(buildInput())
    const b = buildOfflinePackage(buildInput())
    const manifestA = a.payloads.find((p) => p.path === 'manifest.json')!.content
    const manifestB = b.payloads.find((p) => p.path === 'manifest.json')!.content
    const parsedA = JSON.parse(manifestA)
    const parsedB = JSON.parse(manifestB)
    expect(parsedA.manifest_sha256).toBe(parsedB.manifest_sha256)
    expect(parsedA.files).toEqual(parsedB.files)
  })

  it('checksums detect modification', () => {
    const built = buildOfflinePackage(buildInput())
    const manifest = JSON.parse(built.payloads.find((p) => p.path === 'manifest.json')!.content)
    const payloads = built.payloads
      .filter((p) => p.path !== 'manifest.json')
      .map((p) => ({ path: p.path, content: p.content }))
    payloads[0] = { ...payloads[0], content: payloads[0].content.replace('Inspección', 'Inspeccion') }
    const validation = verifyManifestIntegrity(manifest, payloads, SIGNING_KEY)
    expect(validation.valid).toBe(false)
    expect(validation.errors.some((e) => e.startsWith('checksum_mismatch'))).toBe(true)
  })

  it('missing file invalidates integrity', () => {
    const built = buildOfflinePackage(buildInput())
    const manifest = JSON.parse(built.payloads.find((p) => p.path === 'manifest.json')!.content)
    const payloads = built.payloads
      .filter((p) => p.path !== 'manifest.json' && p.path !== 'mission.json')
      .map((p) => ({ path: p.path, content: p.content }))
    const validation = verifyManifestIntegrity(manifest, payloads, SIGNING_KEY)
    expect(validation.valid).toBe(false)
    expect(validation.errors.some((e) => e.startsWith('missing_file'))).toBe(true)
  })

  it('same context signature for same mission snapshot', () => {
    const sigA = buildOfflinePackageContextSignature(buildInput())
    const sigB = buildOfflinePackageContextSignature(buildInput())
    expect(sigA).toBe(sigB)
  })

  it('material task change changes context signature', () => {
    const sigA = buildOfflinePackageContextSignature(buildInput())
    const sigB = buildOfflinePackageContextSignature(
      buildInput({
        tasks: [
          ...baseTasks,
          {
            ...baseTasks[1],
            id: '00000000-0000-4000-a001-000000000103',
            sequence: 3,
            title: 'Extra task',
          },
        ],
      }),
    )
    expect(sigA).not.toBe(sigB)
  })

  it('next package version increments', () => {
    expect(nextPackageVersion([])).toBe(1)
    expect(nextPackageVersion([1, 2])).toBe(3)
  })

  it('unordered tasks produce same signature', () => {
    const reversed = [...baseTasks].reverse()
    const sigA = buildOfflinePackageContextSignature(buildInput({ tasks: baseTasks }))
    const sigB = buildOfflinePackageContextSignature(buildInput({ tasks: reversed }))
    expect(sigA).toBe(sigB)
  })

  it('assigned mission requires assignment unless historical', () => {
    const eligibility = evaluateOfflinePackageEligibility({
      mission: baseMission({ status: 'assigned' }),
      tasks: baseTasks,
      evidence_requirements: baseEvidence,
      assignment: null,
      nowIso: EVALUATED_AT,
    })
    expect(eligibility.eligible).toBe(false)
    expect(eligibility.reasons).toContain('assignment_required')
  })

  it('expired package validity blocks new execution locally', () => {
    const built = buildOfflinePackage(buildInput())
    const repo = OfflinePackageRepository.createInMemory()
    const saved = repo.saveDownload({
      mission_id: baseMission().id as string,
      mission_title: baseMission().title as string,
      manifest: JSON.parse(built.payloads.find((p) => p.path === 'manifest.json')!.content),
      payloads: built.payloads
        .filter((p) => p.path !== 'manifest.json')
        .map((p) => ({ path: p.path, content: p.content })),
      signingKey: SIGNING_KEY,
    })
    return saved.then((record) => {
      expect(canOpenLocalPackage(record)).toBe(true)
      expect(canStartFieldExecution(record, '2026-07-13T00:00:00.000Z')).toBe(false)
    })
  })

  it('corrupt local package becomes integrity_failed', async () => {
    const built = buildOfflinePackage(buildInput())
    const manifest = JSON.parse(built.payloads.find((p) => p.path === 'manifest.json')!.content)
    const payloads = built.payloads
      .filter((p) => p.path !== 'manifest.json')
      .map((p) => ({ path: p.path, content: p.content }))
    payloads[0] = { ...payloads[0], content: '{}' }
    const repo = OfflinePackageRepository.createInMemory()
    const saved = await repo.saveDownload({
      mission_id: String(baseMission().id),
      mission_title: String(baseMission().title),
      manifest,
      payloads,
      signingKey: SIGNING_KEY,
    })
    expect(saved.local_status).toBe('integrity_failed')
    expect(canOpenLocalPackage(saved)).toBe(false)
  })

  it('forbidden copy is rejected', () => {
    expect(containsForbiddenOfflinePackageCopy('incendio confirmado en el área')).toBe(
      'incendio confirmado',
    )
    expect(() =>
      buildOfflinePackage(
        buildInput({ mission: baseMission({ objective: 'incendio confirmado en sector' }) }),
      ),
    ).toThrow(/Copy prohibido/)
  })

  it('canonical json is stable regardless of key order', () => {
    const a = canonicalJson({ b: 1, a: 2, nested: { z: 1, y: 2 } })
    const b = canonicalJson({ nested: { y: 2, z: 1 }, a: 2, b: 1 })
    expect(a).toBe(b)
    expect(sha256Hex(a)).toBe(sha256Hex(b))
  })

  it('remote analytical mission type is not offline capable', () => {
    const result = buildOfflinePackage(
      buildInput({ mission: baseMission({ mission_type: 'remote_analytical_review' }) }),
    )
    expect(result.decision).toBe('not_eligible')
    expect(result.reasons).toContain('mission_type_not_offline_capable')
  })
})
