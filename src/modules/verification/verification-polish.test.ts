import { describe, expect, it } from 'vitest'

import { activeQuestionsLabel, pluralizeCount } from '@/shared/format/plural'
import { lifecycleStateLabel } from '@/modules/lifecycle/utils/lifecycle-labels'
import {
  incidentHistoryActionLabel,
  incidentTypeLabel,
} from '@/modules/incidents/utils/incident-labels'
import {
  verificationClassificationText,
  VERIFICATION_NOT_REQUIRED_REASON,
} from '@/modules/verification/utils/verification-labels'
import { buildIntelligenceFlowActions } from '@/modules/intelligence-flow/intelligence-flow-actions'
import type { IntelligenceFlowDto } from '@/modules/intelligence-flow/intelligence-flow.types'
import type { TerramindPermission } from '@/core/auth/permissions'

describe('pluralization', () => {
  it('never renders "0 pregunta(s) activa(s)"', () => {
    expect(activeQuestionsLabel(0)).toBe('Sin preguntas activas')
    expect(activeQuestionsLabel(1)).toBe('1 pregunta activa')
    expect(activeQuestionsLabel(3)).toBe('3 preguntas activas')
    for (const n of [0, 1, 2, 5]) {
      expect(activeQuestionsLabel(n)).not.toContain('(s)')
    }
  })

  it('pluralizeCount supports custom zero and count omission', () => {
    expect(pluralizeCount(2, 'misión', 'misiones')).toBe('2 misiones')
    expect(pluralizeCount(0, 'misión', 'misiones', { zero: 'Sin misiones' })).toBe('Sin misiones')
    expect(pluralizeCount(1, 'misión', 'misiones', { includeCount: false })).toBe('misión')
  })
})

describe('lifecycle labels normalize the lifecycle_ prefix', () => {
  it('translates lifecycle_expanding and bare expanding', () => {
    expect(lifecycleStateLabel('lifecycle_expanding')).toBe('En expansión')
    expect(lifecycleStateLabel('expanding')).toBe('En expansión')
    expect(lifecycleStateLabel('lifecycle_persistent')).toBe('Persistente')
  })

  it('never leaks a raw snake_case token', () => {
    expect(lifecycleStateLabel('lifecycle_expanding')).not.toContain('_')
  })
})

describe('incident labels', () => {
  it('translates internal incident types instead of showing "fire"', () => {
    expect(incidentTypeLabel('fire')).toBe('Actividad térmica')
    expect(incidentTypeLabel('vegetation_fire_incident')).toBe('Actividad térmica')
  })

  it('translates membership-history actions (no raw "Joined")', () => {
    expect(incidentHistoryActionLabel('joined')).toBe('Incorporado al incidente')
    expect(incidentHistoryActionLabel('left')).toBe('Retirado del incidente')
    expect(incidentHistoryActionLabel('role_changed')).toBe('Cambio de rol')
  })
})

describe('verification classification + reason copy', () => {
  it('labels each classification distinctly', () => {
    expect(verificationClassificationText('operational')).toBe('Operacional')
    expect(verificationClassificationText('legacy')).toBe('Registro histórico · organización pendiente')
    expect(verificationClassificationText('demo')).toBe('Demostración interna')
  })

  it('explains why verification is not required without contradiction', () => {
    expect(VERIFICATION_NOT_REQUIRED_REASON).toContain('no identificó preguntas activas')
  })
})

describe('intelligence flow actions — no duplicate "Ver verificación" on incident page', () => {
  function flow(currentStage: IntelligenceFlowDto['current_stage']): IntelligenceFlowDto {
    return {
      resource_type: 'incident',
      resource_id: 'inc-1',
      current_stage: currentStage,
      classification: 'operational',
      generated_at: new Date().toISOString(),
      nodes: [
        {
          stage: 'verification',
          status: 'available',
          label: 'Verificación',
          route: '/incidentes/inc-1#verificacion',
        },
      ],
    }
  }
  const perms = new Set<TerramindPermission>()

  it('omits verification link when already on the incident (embeds it inline)', () => {
    const actions = buildIntelligenceFlowActions(flow('incident'), perms, true)
    expect(actions.find((a) => a.id === 'verification')).toBeUndefined()
  })

  it('keeps verification link on other stages (e.g. finding)', () => {
    const actions = buildIntelligenceFlowActions(flow('finding'), perms, true)
    expect(actions.find((a) => a.id === 'verification')).toBeDefined()
  })
})
