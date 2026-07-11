import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { classifyMission } from '../../../server/services/missions.service.js'
import { pluralizeCount } from '@/shared/format/plural'
import { missionWorkflowActionLabel } from './utils/mission-labels'
import {
  MISSION_DEMO_ACTIONS_DISABLED,
  MISSION_DEMO_LOCATION,
  MISSION_DEMO_OBJECTIVE,
  MISSION_DEMO_RESPONSIBLE,
  filterMissionsByMode,
  missionDisplayLocation,
  missionDisplayObjective,
  missionDisplayTitle,
  missionPriorityLabel,
  missionShortRef,
  sanitizeMissionReason,
  shouldShowExpiry,
} from './utils/mission-presentation'

const here = dirname(fileURLToPath(import.meta.url))

describe('server classifyMission — robust demo detection', () => {
  it('classifies the internal pilot title as demo', () => {
    expect(
      classifyMission({ title: 'Field Sync Pilot — Internal Verification', incident_id: 'x' }),
    ).toBe('demo')
  })

  it('classifies the internal pilot mission-profile version as demo', () => {
    expect(
      classifyMission({ title: 'Otra misión', incident_id: 'x', mission_profile_version: '8B.7G-pilot' }),
    ).toBe('demo')
  })

  it('classifies source_snapshot.internal_pilot as demo', () => {
    expect(
      classifyMission({ title: 'Otra misión', incident_id: 'x', source_snapshot: { internal_pilot: true } }),
    ).toBe('demo')
  })

  it('treats a normal mission as operational', () => {
    expect(
      classifyMission({ title: 'Verificación de campo real', incident_id: 'op-incident' }),
    ).toBe('operational')
  })
})

describe('demo excluded by default (defense-in-depth)', () => {
  const items = [
    { id: 'a', classification: 'operational' as const },
    { id: 'b', classification: 'demo' as const },
    { id: 'c', classification: 'operational' as const },
  ]

  it('never renders demo missions when demo mode is off', () => {
    const filtered = filterMissionsByMode(items, false)
    expect(filtered.map((m) => m.id)).toEqual(['a', 'c'])
    expect(filtered.some((m) => m.classification === 'demo')).toBe(false)
  })

  it('keeps demo missions filtered even if a cached ?demo=1 response is reused', () => {
    // Simulates a previously cached demo-included payload being shown on /misiones.
    const cachedWithDemo = [...items, { id: 'd', classification: 'demo' as const }]
    const filtered = filterMissionsByMode(cachedWithDemo, false)
    expect(filtered.every((m) => m.classification !== 'demo')).toBe(true)
  })

  it('includes demo missions only when demo mode is explicitly on', () => {
    expect(filterMissionsByMode(items, true).map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('mission display avoids internal language', () => {
  const demoMission = {
    id: '7151e1bd-aaaa-bbbb-cccc-ddddeeeeffff',
    title: 'Field Sync Pilot — Internal Verification',
    mission_type: 'field_verification',
  }

  it('shows a translated type + short reference instead of the pilot title', () => {
    const title = missionDisplayTitle(demoMission, 'demo')
    expect(title).toContain('Ref.')
    expect(title).not.toContain('Field Sync Pilot')
    expect(title).not.toContain('Internal Verification')
  })

  it('keeps the real title for operational missions', () => {
    expect(
      missionDisplayTitle({ id: '1', title: 'Verificación de campo real', mission_type: 'field_verification' }, 'operational'),
    ).toBe('Verificación de campo real')
  })

  it('produces a stable short reference', () => {
    expect(missionShortRef('7151e1bd-aaaa')).toBe('7151')
  })

  it('replaces demo objective and location with safe copy', () => {
    expect(missionDisplayObjective('Misión técnica interna 8B.7G — validación de field sync real.', 'demo')).toBe(
      MISSION_DEMO_OBJECTIVE,
    )
    expect(missionDisplayLocation('Pilot site — internal only', 'demo')).toBe(MISSION_DEMO_LOCATION)
  })
})

describe('sanitizeMissionReason strips internal residue', () => {
  it('returns a generic demo label for demo missions', () => {
    expect(sanitizeMissionReason('8B.7G pilot assignment', 'demo')).toBe('Asignación de demostración')
  })

  it('drops internal phase codes and pilot fixtures on operational records', () => {
    expect(sanitizeMissionReason('8B.7G pilot assignment', 'operational')).toBeNull()
    expect(sanitizeMissionReason('field sync internal only', 'operational')).toBeNull()
  })

  it('keeps a normal human reason', () => {
    expect(sanitizeMissionReason('Reasignado por disponibilidad del equipo', 'operational')).toBe(
      'Reasignado por disponibilidad del equipo',
    )
  })
})

describe('priority + workflow labels', () => {
  it('renders priority as a category (P1), never a bare number', () => {
    expect(missionPriorityLabel(1)).toBe('Prioridad operativa: P1')
    expect(missionPriorityLabel(1)).not.toBe('Prioridad 1')
  })

  it('translates workflow actions to Spanish', () => {
    expect(missionWorkflowActionLabel('accept')).toBe('Aceptar')
    expect(missionWorkflowActionLabel('decline')).toBe('Rechazar')
    expect(missionWorkflowActionLabel('reassign')).toBe('Reasignar')
    expect(missionWorkflowActionLabel('cancel')).toBe('Cancelar misión')
  })
})

describe('pluralization + dates', () => {
  it('uses proper plurals without "(s)"', () => {
    expect(pluralizeCount(1, 'tarea', 'tareas')).toBe('1 tarea')
    expect(pluralizeCount(2, 'tarea', 'tareas')).toBe('2 tareas')
    expect(pluralizeCount(1, 'evidencia requerida', 'evidencias requeridas')).toBe('1 evidencia requerida')
    expect(pluralizeCount(2, 'evidencia requerida', 'evidencias requeridas')).toBe('2 evidencias requeridas')
  })

  it('hides expiry when it equals the due date', () => {
    expect(shouldShowExpiry('2026-07-17T17:55:00Z', '2026-07-17T17:55:00Z')).toBe(false)
    expect(shouldShowExpiry('2026-07-17T17:55:00Z', '2026-07-24T17:55:00Z')).toBe(true)
  })
})

describe('demo safety constants', () => {
  it('states operational actions are disabled', () => {
    expect(MISSION_DEMO_ACTIONS_DISABLED).toContain('demostración interna')
    expect(MISSION_DEMO_RESPONSIBLE).toBe('Responsable de demostración')
  })
})

describe('mission UI source hygiene (no raw internal language)', () => {
  function read(relative: string): string {
    return readFileSync(resolve(here, relative), 'utf8')
  }

  it('workflow actions never render the raw English verb and drop the raw id placeholder', () => {
    const src = read('./components/MissionWorkflowActions.tsx')
    expect(src).toContain('missionWorkflowActionLabel(action)')
    expect(src).not.toContain('placeholder="user-id o team-id"')
  })

  it('detail page has no pilot/internal literals in the rendered copy', () => {
    const src = read('./pages/MissionDetailPage.tsx')
    expect(src).not.toContain('Field Sync Pilot')
    expect(src).not.toContain('8B.7G')
  })
})
