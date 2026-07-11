import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  evidenceTypeLabel,
  humanizeToken,
  participationLabel,
} from '@/shared/product-language'
import {
  missionAssignmentStatusLabel,
  missionTaskStatusLabel,
  missionTypeLabel,
} from '@/modules/missions/utils/mission-labels'
import {
  biodiversityProviderLabel,
  biodiversityQualityGradeLabel,
} from '@/modules/biodiversity/utils/biodiversity-labels'

function read(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('hotfix — Field Sync single status', () => {
  it('field pages render the canonical status card and drop contradictory banners', () => {
    const sync = read('src/modules/field-operations/pages/FieldSyncPage.tsx')
    const home = read('src/modules/field-operations/pages/FieldCampoHomePage.tsx')
    expect(sync).toContain('FieldSyncStatusCard')
    expect(home).toContain('FieldSyncStatusCard')
    // contradictory copy must be gone from the home screen
    expect(home).not.toContain('Conectividad limitada')
  })
})

describe('hotfix — demo missions excluded by default', () => {
  it('MissionsPage keeps demo hidden unless explicitly requested', () => {
    const src = read('src/modules/missions/pages/MissionsPage.tsx')
    expect(src).toContain("searchParams.get('demo')")
    expect(src).toContain('include_demo')
  })

  it('server classifies and excludes demo missions when include_demo is false', () => {
    const src = read('server/services/missions.service.ts')
    expect(src).toContain('classifyMission')
    expect(src).toContain('demo_excluded')
    expect(src).toContain("classification === 'demo' && !includeDemo")
  })
})

describe('hotfix — not_required resolution semantics', () => {
  it('separates "no requiere" from "pendiente de evidencia"', () => {
    const src = read('src/modules/verification/components/IncidentVerificationResolutionSection.tsx')
    expect(src).toContain('No se requiere resolución de verificación')
    expect(src).toContain('Resolución pendiente de evidencia')
    expect(src).toContain('verificationRequired')
  })
})

describe('hotfix — no duplicate CTAs', () => {
  it('actions are unified under a single "Acciones relacionadas" strip', () => {
    const panel = read('src/modules/intelligence-flow/components/IntelligenceFlowActionsPanel.tsx')
    expect(panel).toContain('Acciones relacionadas')
    expect(panel).not.toContain('Continuar en el ciclo')
  })

  it('incident detail no longer duplicates report/verification CTAs in header + stage nav', () => {
    const src = read('src/modules/incidents/pages/IncidentDetailPage.tsx')
    expect(src).not.toContain('StageNavigationLinks')
    // "Generar informe" now lives only in the related-actions strip, not the header
    expect(src).not.toContain('Generar informe')
  })

  it('cycle is collapsible and rendered after content, not dominating the top', () => {
    const nav = read('src/modules/intelligence-flow/components/IntelligenceFlowNavigator.tsx')
    expect(nav).toContain('collapsible')
    expect(nav).toContain('<details')
  })
})

describe('hotfix — pipeline single status', () => {
  it('collapses multiple warning badges into one', () => {
    const line = read('src/modules/fires/components/FirePipelineStatusLine.tsx')
    const status = read('src/modules/fires/utils/thermal-data-status.ts')
    expect(line).toContain('resolveThermalDataStatus')
    expect(status).toContain('Datos retrasados')
    expect(line).not.toContain('Pipeline en advertencia')
    expect(line).not.toContain('Pipeline desactualizado')
  })
})

describe('hotfix — incident classification tabs', () => {
  it('provides Operacionales/Históricos/Demostración tabs defaulting to operational', () => {
    const src = read('src/modules/incidents/pages/IncidentsPage.tsx')
    expect(src).toContain('Operacionales')
    expect(src).toContain('Históricos')
    expect(src).toContain('Demostración')
    expect(src).toContain("useState<IncidentTab>('operational')")
  })
})

describe('hotfix — report hub structure', () => {
  it('separates generate / recent / types / formats and demotes A4 to a format', () => {
    const src = read('src/modules/executive-demo/pages/ReportsHubPage.tsx')
    expect(src).toContain('Generar nuevo informe')
    expect(src).toContain('Informes recientes')
    expect(src).toContain('Tipos de informe')
    expect(src).toContain('Formatos disponibles')
    // A4 is a format, not a report type card
    expect(src).toContain('Impresión A4')
    expect(src).toContain('REPORT_FORMATS')
  })
})

describe('hotfix — dynamic token translation', () => {
  it('translates evidence types', () => {
    expect(evidenceTypeLabel('photo')).toBe('Fotografía')
    expect(evidenceTypeLabel('structured_observation')).toBe('Observación estructurada')
  })

  it('translates participation roles', () => {
    expect(participationLabel('primary')).toBe('Principal')
    expect(participationLabel('joined')).toBe('Incorporado')
  })

  it('translates mission enums including field_verification and assigned', () => {
    expect(missionTypeLabel('field_verification')).toBe('Verificación de campo')
    expect(missionAssignmentStatusLabel('assigned')).toBe('Asignada')
    expect(missionTaskStatusLabel('pending')).toBe('Pendiente')
  })

  it('translates biodiversity provider casing and quality grade', () => {
    expect(biodiversityProviderLabel('inaturalist')).toBe('iNaturalist')
    expect(biodiversityProviderLabel('gbif')).toBe('GBIF')
    expect(biodiversityQualityGradeLabel('research')).toBe('Grado de investigación')
  })

  it('humanizes any unmapped snake_case token instead of leaking it raw', () => {
    expect(humanizeToken('lifecycle_expanding')).toBe('Lifecycle expanding')
    expect(humanizeToken('structured_observation')).not.toContain('_')
  })
})
