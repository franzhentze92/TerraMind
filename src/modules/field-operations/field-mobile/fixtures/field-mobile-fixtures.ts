import { buildOfflinePackage } from '@/modules/field-operations/offline-packages/engine/offline-package.engine'
import { ALL_OFFLINE_PACKAGE_PERMISSIONS } from '@/modules/field-operations/offline-packages/offline-package-permissions'
import { SYNTHETIC_FIXTURE_TAG } from '@/modules/field-operations/field-mobile/config/fire-field-mobile.config'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'

export const SYNTHETIC_PACKAGE_ID = '00000000-0000-4000-a00e-000000000501'
export const SYNTHETIC_MISSION_ID = '00000000-0000-4000-a00e-000000000001'
export const SYNTHETIC_TASK_OBS = '00000000-0000-4000-a00e-000000000101'
export const SYNTHETIC_TASK_PHOTO = '00000000-0000-4000-a00e-000000000102'

const EVALUATED_AT = '2026-07-10T12:00:00.000Z'

export function buildSyntheticFieldPackageRecord(): LocalOfflinePackageRecord {
  const mission = {
    id: SYNTHETIC_MISSION_ID,
    mission_type: 'field_visual_inspection',
    title: `[${SYNTHETIC_FIXTURE_TAG}] Inspección demo`,
    objective: 'Paquete sintético para pruebas móviles offline.',
    status: 'ready',
    incident_id: '00000000-0000-4000-a00e-000000000010',
    verification_plan_id: '00000000-0000-4000-a00e-000000000020',
    recommended_method_code: 'field_visual_inspection',
    location_geometry: { type: 'Point', coordinates: [-90.5, 14.6] },
    location_description: 'Sector demo',
    priority: 70,
    earliest_start_at: '2026-07-10T08:00:00.000Z',
    due_at: '2026-07-11T08:00:00.000Z',
    expires_at: '2026-07-12T08:00:00.000Z',
    completion_criteria: { text: 'Demo completada' },
    inconclusive_criteria: { text: 'Visibilidad limitada' },
    blocking_conditions: [],
    cancellation_conditions: [],
    mission_profile_version: '1.0.0',
    source_snapshot: { reasons: [], eligibility: { limitations: [] } },
    context_signature: 'ctx-mobile-fixture',
  }
  const tasks = [
    {
      id: SYNTHETIC_TASK_OBS,
      sequence: 1,
      task_type: 'structured_observation',
      title: 'Observación estructurada',
      instructions: 'Documentar indicadores visibles.',
      required: true,
      completion_criteria: { text: 'Hecho' },
      status: 'pending',
    },
    {
      id: SYNTHETIC_TASK_PHOTO,
      sequence: 2,
      task_type: 'capture_georeferenced_photos',
      title: 'Fotografías georreferenciadas',
      instructions: 'Capturar al menos una foto con ubicación.',
      required: true,
      completion_criteria: { text: 'Hecho' },
      status: 'pending',
    },
  ]
  const evidence = [
    {
      id: '00000000-0000-4000-a00e-000000000201',
      evidence_type: 'structured_observation',
      required: true,
      minimum_count: 1,
      required_metadata: [],
      quality_criteria: [],
      acceptance_criteria: { text: 'Observación' },
    },
    {
      id: '00000000-0000-4000-a00e-000000000202',
      evidence_type: 'georeferenced_photo',
      required: true,
      minimum_count: 1,
      required_metadata: ['lat', 'lon'],
      quality_criteria: [],
      acceptance_criteria: { text: 'Foto GPS' },
    },
  ]
  const built = buildOfflinePackage({
    package_id: SYNTHETIC_PACKAGE_ID,
    package_version: 1,
    mission,
    tasks,
    evidence_requirements: evidence,
    assignment: null,
    plan_needs: [],
    incident: null,
    permissions: ALL_OFFLINE_PACKAGE_PERMISSIONS,
    actor_id: SYNTHETIC_FIXTURE_TAG,
    evaluated_at: EVALUATED_AT,
    signingKey: 'synthetic-mobile-key',
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
    size_bytes: built.payloads.reduce((s, p) => s + p.content.length, 0),
    integrity_errors: [],
    updated_at: EVALUATED_AT,
  }
}
