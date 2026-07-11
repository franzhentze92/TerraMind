import { describe, expect, it } from 'vitest'

import {
  buildIncidentBreadcrumbLabel,
  buildIncidentDisplayName,
} from '@/modules/incidents/utils/incident-display-name'
import { findInternalPhaseCodes } from '@/shared/product-language'

describe('incident display name', () => {
  it('uses department when available', () => {
    expect(
      buildIncidentDisplayName({
        incident_type: 'possible_vegetation_fire_incident',
        department_name: 'Quetzaltenango',
        lifecycle_state: 'persistent',
      }),
    ).toBe('Actividad térmica persistente en Quetzaltenango')
  })

  it('never declares incendio', () => {
    const name = buildIncidentDisplayName({
      incident_type: 'possible_vegetation_fire_incident',
      department_name: 'Petén',
    })
    expect(name.toLowerCase()).not.toContain('incendio')
  })

  it('fallback when location unknown', () => {
    expect(
      buildIncidentDisplayName({
        incident_type: 'possible_vegetation_fire_incident',
        event_count: 3,
      }),
    ).toBe('Actividad térmica con ubicación pendiente')
  })

  it('breadcrumb never contains UUID pattern', () => {
    const label = buildIncidentBreadcrumbLabel({
      incident_type: 'possible_vegetation_fire_incident',
      department_name: 'Retalhuleu',
    })
    expect(label).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/i)
    expect(findInternalPhaseCodes(label)).toHaveLength(0)
  })
})
