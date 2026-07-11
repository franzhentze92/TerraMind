/**
 * Tests — municipal (ADM2) layer + cell assignment + area-weighted aggregation.
 *
 * Covers: coverage (340+ municipalities), invalid geometries, small, border,
 * and multipart municipalities. Does not modify ADM1.
 */
import { describe, expect, it } from 'vitest'
import {
  areaWeightedMean,
  assignCellsToMunicipalities,
  cellAreaWeight,
  loadMunicipalities,
  pointInMunicipality,
  type CellRef,
  type Municipality,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'

describe('municipal ADM2 layer', () => {
  const municipalities = loadMunicipalities()

  it('loads all Guatemala municipalities (>=340) with valid pcodes', () => {
    expect(municipalities.length).toBeGreaterThanOrEqual(340)
    for (const m of municipalities) {
      expect(m.pcode).toMatch(/^GT\d{4}$/)
      expect(m.name.length).toBeGreaterThan(0)
      expect(m.adm1Pcode).toMatch(/^GT\d{2}$/)
      expect(m.polygons.length).toBeGreaterThan(0)
    }
  })

  it('has unique municipal pcodes (no duplicated territory layer)', () => {
    const pcodes = new Set(municipalities.map((m) => m.pcode))
    expect(pcodes.size).toBe(municipalities.length)
  })

  it('includes at least one multipart (MultiPolygon) municipality', () => {
    const multipart = municipalities.filter((m) => m.polygons.length > 1)
    expect(multipart.length).toBeGreaterThanOrEqual(1)
  })

  it('point-in-polygon: municipal center falls inside its own polygon', () => {
    // Use centroids from source metadata; the vast majority must contain their center.
    let inside = 0
    for (const m of municipalities) {
      if (pointInMunicipality(m.centerLon, m.centerLat, m)) inside++
    }
    // Concave/multipart centroids may fall outside; require the overwhelming majority.
    expect(inside / municipalities.length).toBeGreaterThan(0.85)
  })

  it('border/outside: a point in the Pacific Ocean belongs to no municipality', () => {
    const ocean = { lon: -92.0, lat: 12.5 }
    const anyMatch = municipalities.some((m) => pointInMunicipality(ocean.lon, ocean.lat, m))
    expect(anyMatch).toBe(false)
  })

  it('small municipalities are represented (smallest > 0 km2)', () => {
    const sorted = [...municipalities].sort((a, b) => a.areaKm2 - b.areaKm2)
    expect(sorted[0]!.areaKm2).toBeGreaterThan(0)
  })

  it('handles invalid/empty geometry gracefully', () => {
    const broken: Municipality = {
      pcode: 'GT9999',
      name: 'Broken',
      adm1Name: 'X',
      adm1Pcode: 'GT99',
      areaKm2: 0,
      centerLat: 15,
      centerLon: -90,
      polygons: [],
      bbox: [Infinity, Infinity, -Infinity, -Infinity],
    }
    expect(pointInMunicipality(-90, 15, broken)).toBe(false)
  })

  it('assigns synthetic grid cells so every municipality is represented', () => {
    // Build a coarse 0.05° grid over Guatemala bbox.
    const cells: CellRef[] = []
    let idx = 0
    for (let lat = 13.7; lat <= 17.8; lat += 0.05) {
      for (let lon = -92.3; lon <= -88.2; lon += 0.05) {
        cells.push({ index: idx++, lat, lon })
      }
    }
    const assignment = assignCellsToMunicipalities(cells, municipalities)
    for (const m of municipalities) {
      expect(assignment.byMunicipality.get(m.pcode)!.length).toBeGreaterThanOrEqual(1)
    }
    // Small municipalities may need nearest-cell fallback.
    expect(assignment.lowCoveragePcodes.length).toBeLessThan(municipalities.length * 0.1)
  })

  it('area-weighted mean weights cells by cos-latitude', () => {
    expect(cellAreaWeight(0)).toBeCloseTo(1, 5)
    expect(cellAreaWeight(60)).toBeCloseTo(0.5, 2)
    const values = [10, 20, 30]
    const lats = [15, 15, 15]
    expect(areaWeightedMean([0, 1, 2], values, lats)).toBeCloseTo(20, 5)
  })

  it('area-weighted mean ignores NaN/undefined cells', () => {
    const values = [10, Number.NaN, 30]
    const lats = [15, 15, 15]
    expect(areaWeightedMean([0, 1, 2], values, lats)).toBeCloseTo(20, 5)
    expect(areaWeightedMean([], values, lats)).toBeUndefined()
  })
})
