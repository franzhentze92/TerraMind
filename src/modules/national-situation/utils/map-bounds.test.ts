import { describe, expect, it } from 'vitest'
import {
  boundsFromFeatureCollection,
  combineBounds,
  hasRenderableGeometry,
} from './map-bounds'

function pointFeature(coordinates: unknown): GeoJSON.Feature {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates } as GeoJSON.Geometry,
    properties: {},
  }
}

function pointFC(points: Array<[number, number]>): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((coordinates, i) => ({
      type: 'Feature',
      id: String(i),
      geometry: { type: 'Point', coordinates },
      properties: {},
    })),
  }
}

describe('boundsFromFeatureCollection', () => {
  it('returns null for an empty collection', () => {
    expect(boundsFromFeatureCollection(pointFC([]))).toBeNull()
  })

  it('computes a [[s,w],[n,e]] box from 13 point events', () => {
    // 13 thermal-like points scattered across Guatemala ([lng, lat]).
    const points: Array<[number, number]> = Array.from({ length: 13 }, (_, i) => [
      -91 - i * 0.1,
      14 + i * 0.1,
    ])
    const box = boundsFromFeatureCollection(pointFC(points))
    expect(box).not.toBeNull()
    const [[south, west], [north, east]] = box!
    expect(south).toBeCloseTo(14)
    expect(north).toBeCloseTo(14 + 12 * 0.1)
    expect(west).toBeCloseTo(-91 - 12 * 0.1)
    expect(east).toBeCloseTo(-91)
  })

  it('handles polygon geometry (rainfall-deficit style)', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-90, 15],
                [-89, 15],
                [-89, 16],
                [-90, 16],
                [-90, 15],
              ],
            ],
          },
          properties: {},
        },
      ],
    }
    const box = boundsFromFeatureCollection(fc)
    expect(box).toEqual([
      [15, -90],
      [16, -89],
    ])
  })
})

describe('hasRenderableGeometry', () => {
  it('accepts a valid Guatemala point [lng, lat]', () => {
    expect(hasRenderableGeometry(pointFeature([-90.5, 15.5]))).toBe(true)
  })

  it('rejects null-island (0,0), NaN and null geometry', () => {
    expect(hasRenderableGeometry(pointFeature([0, 0]))).toBe(false)
    expect(hasRenderableGeometry(pointFeature([NaN, 15]))).toBe(false)
    expect(
      hasRenderableGeometry({
        type: 'Feature',
        geometry: null,
        properties: {},
      } as unknown as GeoJSON.Feature),
    ).toBe(false)
  })

  it('rejects an inverted lat/lng pair (latitude out of ±90)', () => {
    // Correct order [lng, lat] = [-90.5, 15.5] is valid...
    expect(hasRenderableGeometry(pointFeature([-90.5, 15.5]))).toBe(true)
    // ...but the inverted [lat, lng] = [15.5, -90.5] pushes latitude to -90.5,
    // and [15.5, -95] to -95, both out of ±90 → rejected.
    expect(hasRenderableGeometry(pointFeature([15.5, -90.5]))).toBe(false)
    expect(hasRenderableGeometry(pointFeature([15.5, -95]))).toBe(false)
  })
})

describe('boundsFromFeatureCollection — invalid coordinate filtering', () => {
  it('ignores (0,0) so a stray null-island point cannot corrupt bounds', () => {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [pointFeature([-90.5, 15.5]), pointFeature([0, 0])],
    }
    const box = boundsFromFeatureCollection(fc)
    expect(box).toEqual([
      [15.5, -90.5],
      [15.5, -90.5],
    ])
  })
})

describe('combineBounds', () => {
  it('ignores nulls and returns null when all empty', () => {
    expect(combineBounds([null, null])).toBeNull()
  })

  it('unions multiple boxes', () => {
    const combined = combineBounds([
      [
        [14, -92],
        [15, -91],
      ],
      [
        [16, -90],
        [17, -89],
      ],
    ])
    expect(combined).toEqual([
      [14, -92],
      [17, -89],
    ])
  })
})
