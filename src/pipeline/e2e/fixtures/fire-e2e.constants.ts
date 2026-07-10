/** Reloj y versiones congeladas para E2E reproducible */
export const FIRE_E2E_NOW = '2026-07-10T12:00:00.000Z'
export const FIRE_E2E_DETECTED_AT = '2026-07-10T11:30:00.000Z'
export const FIRE_E2E_FIRST_DETECTED = '2026-07-10T11:00:00.000Z'

export const FIRE_E2E_IDS = {
  event: '00000000-0000-4000-a000-000000000001',
  detection: '00000000-0000-4000-a000-000000000010',
  incident: '00000000-0000-4000-a000-000000000020',
  plan: '00000000-0000-4000-a000-000000000030',
  need_visual: '00000000-0000-4000-a000-000000000031',
  need_non_fire: '00000000-0000-4000-a000-000000000032',
  mission: '00000000-0000-4000-a000-000000000040',
  assignment: '00000000-0000-4000-a000-000000000041',
  team: 'synthetic-fire-field-team',
  assignee: 'fixture-field-inspector',
  photo_submission: '00000000-0000-4000-a000-000000000050',
  observation_submission: '00000000-0000-4000-a000-000000000051',
  observation_b_submission: '00000000-0000-4000-a000-000000000052',
} as const

export const FIRE_E2E_GEOMETRY = {
  centroid_lat: 17.215,
  centroid_lng: -89.62,
  mission_polygon: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-89.625, 17.21],
        [-89.615, 17.21],
        [-89.615, 17.22],
        [-89.625, 17.22],
        [-89.625, 17.21],
      ],
    ],
  },
  photo_point: { type: 'Point' as const, coordinates: [-89.62, 17.215] as [number, number] },
} as const

export const FIRE_E2E_MODEL_VERSIONS = {
  lifecycle: '1.0.0',
  findings: '1.0.0',
  priority: '1.0.0',
  incident: '1.0.0',
  verification: '1.0.0',
  mission: '1.0.0',
  validation: '1.0.0',
  resolution: '1.0.0',
} as const

export const FIRE_E2E_DB_PREFIX = 'e2e-fire-'
