import { describe, expect, it } from 'vitest'
import {
  EVENT_FIT_MAX_ZOOM,
  GUATEMALA_MAP_BOUNDS,
  GUATEMALA_FIT_PADDING,
  RISK_MAP_STYLES,
  riskMapStyle,
} from './map-styles'
import { guatemalaBoundsCenter, nationalMapFitOptions } from './map-geometry'

describe('map styles', () => {
  it('defines visual styles for all risk levels', () => {
    expect(RISK_MAP_STYLES.informativo.dashArray).toBeDefined()
    expect(RISK_MAP_STYLES.observacion.fill).toContain('#')
    expect(RISK_MAP_STYLES.atencion.weight).toBeGreaterThan(RISK_MAP_STYLES.observacion.weight)
    expect(RISK_MAP_STYLES.critico.weight).toBeGreaterThan(RISK_MAP_STYLES.alto.weight)
  })

  it('emphasizes selected events', () => {
    const base = riskMapStyle('atencion', false)
    const selected = riskMapStyle('atencion', true)
    expect(selected.weight).toBeGreaterThan(base.weight!)
    expect(selected.fillOpacity).toBeGreaterThan(base.fillOpacity!)
  })

  it('uses dashed border for unvalidated events', () => {
    const probable = riskMapStyle('observacion', false, 'probable')
    const unvalidated = riskMapStyle('observacion', false, 'no_validado')
    expect(probable.dashArray).toBeUndefined()
    expect(unvalidated.dashArray).toBe('6 4')
  })

  it('falls back to informativo for unknown risk', () => {
    const style = riskMapStyle('desconocido')
    expect(style.fillColor).toBe('#6b7280')
  })
})

describe('national map fit', () => {
  it('fits Guatemala bounds with small padding', () => {
    const opts = nationalMapFitOptions()
    expect(opts.bounds).toEqual(GUATEMALA_MAP_BOUNDS)
    expect(opts.padding).toEqual(GUATEMALA_FIT_PADDING)
  })

  it('centers within Guatemala extent', () => {
    const [lat, lng] = guatemalaBoundsCenter()
    const [[south, west], [north, east]] = GUATEMALA_MAP_BOUNDS
    expect(lat).toBeGreaterThan(south)
    expect(lat).toBeLessThan(north)
    expect(lng).toBeGreaterThan(west)
    expect(lng).toBeLessThan(east)
  })

  it('limits event zoom to regional context', () => {
    expect(EVENT_FIT_MAX_ZOOM).toBeLessThanOrEqual(11)
  })
})
