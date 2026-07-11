import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ensureEventsRegistered } from '@/modules/environmental-events/registry/register-all'
import { environmentalEventRegistry } from '@/modules/environmental-events/registry/event-type-registry'
import {
  buildEnabledEventTypeCatalog,
  buildEventCardModel,
  buildEventDetailModel,
  buildEventLegend,
  buildEventPopup,
  buildEventReportSection,
} from '@/modules/environmental-events/ui/event-ui'
import { mapFireEventToEnvironmentalEvent } from '@/modules/environmental-events/thermal/thermal-event.mapper'
import { syntheticFixtures } from '@/events/synthetic-framework-test/event.repository'
import type { FireEventListItemDto } from '@/modules/fires/types/fire.dto'

function thermalEvent() {
  const dto: FireEventListItemDto = {
    id: '11111111-1111-4111-8111-111111111111',
    department_code: 'GT01',
    department_name: 'Petén',
    status: 'active',
    validation_status: 'probable',
    risk_level: 'atencion',
    priority_score: 72,
    centroid_lat: 16.9,
    centroid_lng: -89.9,
    first_detected_at: '2026-07-10T10:00:00.000Z',
    last_detected_at: '2026-07-10T18:00:00.000Z',
    persistence_hours: 8,
    detection_count: 5,
    satellite_count: 2,
    source_products: ['VIIRS_SNPP_NRT', 'MODIS_NRT'],
    max_frp_mw: 42.5,
    geometry_method: 'convex_hull_buffer',
    cross_department: false,
    created_at: '2026-07-10T10:05:00.000Z',
  }
  return mapFireEventToEnvironmentalEvent(dto)
}

beforeAll(() => ensureEventsRegistered())
afterAll(() => environmentalEventRegistry.setIncludeDisabled(false))

describe('generic UI builders (thermal)', () => {
  it('builds a card model from the manifest presentation', () => {
    const card = buildEventCardModel(thermalEvent())
    expect(card.type).toBe('thermal_activity')
    expect(card.title).toContain('Evento térmico')
    expect(card.metrics.length).toBeGreaterThan(0)
  })

  it('builds a detail model with sections, methodology and limitations', () => {
    const detail = buildEventDetailModel(thermalEvent())
    expect(detail.sections.length).toBeGreaterThan(0)
    expect(detail.methodology.length).toBeGreaterThan(0)
    expect(detail.limitations.length).toBeGreaterThan(0)
  })

  it('builds legend and popup from the manifest renderer', () => {
    const legend = buildEventLegend('thermal_activity')
    expect(legend.title.length).toBeGreaterThan(0)
    const popup = buildEventPopup(thermalEvent())
    expect(popup.rows.length).toBeGreaterThan(0)
  })

  it('builds a report section from the manifest report adapter', () => {
    const section = buildEventReportSection('thermal_activity', [thermalEvent()])
    expect(section.title).toBe('Actividad térmica')
  })

  it('lists only enabled types in the catalog', () => {
    const catalog = buildEnabledEventTypeCatalog()
    expect(catalog.some((c) => c.type === 'thermal_activity')).toBe(true)
    expect(catalog.some((c) => c.type === 'synthetic_framework_test')).toBe(false)
  })
})

describe('generic UI builders (synthetic, flag on)', () => {
  beforeAll(() => environmentalEventRegistry.setIncludeDisabled(true))

  it('renders a synthetic card and report from the same generic builders', () => {
    const card = buildEventCardModel(syntheticFixtures[0])
    expect(card.type).toBe('synthetic_framework_test')
    const section = buildEventReportSection('synthetic_framework_test', [syntheticFixtures[0]])
    expect(section.title).toContain('sintético')
  })
})
