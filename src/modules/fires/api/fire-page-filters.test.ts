import { describe, expect, it } from 'vitest'
import {
  buildIncendiosPath,
  countActiveFilters,
  pageFiltersToApiQuery,
  pageFiltersToSearchParams,
  parsePageFilters,
} from '@/modules/fires/api/fire-page-filters'
import {
  buildEventInterpretation,
  eventSemanticLabel,
} from '@/modules/fires/utils/fire-interpretation'
import { FIRE_AREA_DISCLAIMER } from '@/modules/fires/config/fire.constants'
import { FIRE_SENSITIVE_FIELDS } from '@/modules/fires/types/fire.dto'

describe('fire page filters', () => {
  it('parses filters from query string', () => {
    const filters = parsePageFilters(
      new URLSearchParams('period=24h&risk_level=atencion&page=2'),
    )
    expect(filters.period).toBe('24h')
    expect(filters.risk_level).toBe('atencion')
    expect(filters.page).toBe(2)
  })

  it('round-trips filters to search params', () => {
    const filters = parsePageFilters(
      new URLSearchParams('department_code=11&min_priority=40'),
    )
    const params = pageFiltersToSearchParams(filters)
    expect(params.get('department_code')).toBe('11')
    expect(params.get('min_priority')).toBe('40')
  })

  it('builds API query with since and pagination', () => {
    const now = new Date('2026-07-10T12:00:00.000Z')
    const query = pageFiltersToApiQuery({ period: '48h', page: 2 }, now)
    expect(query.since).toBe('2026-07-08T12:00:00.000Z')
    expect(query.limit).toBe(25)
    expect(query.offset).toBe(25)
  })

  it('omits empty filters from API query', () => {
    const query = pageFiltersToApiQuery({ period: '48h', page: 1 })
    expect(query.department_code).toBeUndefined()
    expect(query.risk_level).toBeUndefined()
  })

  it('builds navigation path preserving filters and event', () => {
    const path = buildIncendiosPath(
      { period: '48h', page: 1, risk_level: 'atencion' },
      'abc-123',
    )
    expect(path).toContain('/incendios/abc-123')
    expect(path).toContain('risk_level=atencion')
  })

  it('counts active filters', () => {
    expect(
      countActiveFilters({ period: '48h', page: 1, risk_level: 'atencion' }),
    ).toBe(1)
  })

  it('uses same API filters for table and map queries', () => {
    const filters = {
      period: '24h' as const,
      page: 2,
      department_code: '11',
      risk_level: 'atencion',
      min_priority: 40,
    }
    const now = new Date('2026-07-10T12:00:00.000Z')
    const tableQuery = pageFiltersToApiQuery(filters, now)
    const mapQuery = pageFiltersToApiQuery({ ...filters, page: 1 }, now)

    expect(mapQuery.since).toBe(tableQuery.since)
    expect(mapQuery.until).toBe(tableQuery.until)
    expect(mapQuery.department_code).toBe('11')
    expect(mapQuery.risk_level).toBe('atencion')
    expect(mapQuery.min_priority).toBe(40)
    expect(mapQuery.offset).toBe(0)
  })

  it('builds event selection path from map interaction', () => {
    const path = buildIncendiosPath(
      { period: '24h', page: 1, department_code: '11' },
      'evt-retalhuleu',
    )
    expect(path).toBe('/incendios/evt-retalhuleu?period=24h&department_code=11')
  })
})

describe('fire interpretation', () => {
  it('describes single detection event', () => {
    const text = buildEventInterpretation({
      detection_count: 1,
      satellite_count: 1,
      validation_status: 'no_validado',
      risk_level: 'informativo',
      persistence_hours: 0,
      multisatellite: false,
    })
    expect(text).toContain('una sola detección')
  })

  it('describes multi-satellite attention event', () => {
    const text = buildEventInterpretation({
      detection_count: 3,
      satellite_count: 2,
      validation_status: 'probable',
      risk_level: 'atencion',
      persistence_hours: 0.35,
      multisatellite: true,
    })
    expect(text).toContain('3 detecciones')
    expect(text).toContain('2 satélites')
    expect(text).toContain('atención operativa')
  })

  it('labels event semantics for map popups', () => {
    expect(eventSemanticLabel('probable')).toBe('Evento térmico probable')
    expect(eventSemanticLabel('no_validado')).toBe('Detección no validada')
    expect(eventSemanticLabel('confirmado')).toBe('Incendio confirmado')
  })
})

describe('detail DTO safety', () => {
  it('documents area disclaimer constant', () => {
    expect(FIRE_AREA_DISCLAIMER).toContain('No corresponde a área quemada')
  })

  it('lists sensitive fields to exclude from list DTO', () => {
    expect(FIRE_SENSITIVE_FIELDS).toContain('raw_payload')
    expect(FIRE_SENSITIVE_FIELDS).toContain('metadata')
  })
})
