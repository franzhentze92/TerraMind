import { readFileSync } from 'node:fs'
import { gdalInfoJson } from '@/modules/territory/land-cover/processing/gdal'
import { runCommand } from '@/modules/territory/land-cover/processing/gdal'
import {
  GUATEMALA_ADM0_GEOJSON,
  GUATEMALA_BOUNDARY_AREA_SQKM_PROPERTY,
  LAEA_PROJ4,
  LAND_COVER_ANALYTIC_COG,
  LAND_COVER_SOURCE_COG,
} from '@/modules/territory/land-cover/processing/paths'
import { parseGdalInfoJson } from '@/modules/territory/land-cover/processing/raster-stats'
import { distributionFromGdalSummary } from '@/modules/territory/land-cover/raster/raster-distribution'
import { withRasterTempWorkspace } from '@/modules/territory/land-cover/raster/raster-temp'
import { analyzeNationalRasterMasked } from '@/modules/territory/land-cover/raster/raster-zone-analyzer'
import { samplePointFromRaster } from '@/modules/territory/land-cover/raster/raster-point-sampler'
import { mapEsaWorldCoverCode } from '@/modules/territory/land-cover/providers/esa-worldcover/esa-worldcover.mapper'

const D2R = Math.PI / 180
const EARTH_RADIUS_M = 6378137

export interface BoundaryAreaAudit {
  hdxAreaSqkmProperty: number | null
  geodesicAreaSqkm: number
  laeaPlanarAreaSqkm: number
  rasterValidAreaSqkm: number
  rasterMinusBoundarySqkm: number
  rasterMinusBoundaryPct: number
  nodataInsideBoundaryPixels: number
  validOutsideBoundaryPixels: number
  borderPixelImpactEstimateSqkm: number
}

export interface ManualSpotCheck {
  name: string
  latitude: number
  longitude: number
  providerClassCode: number | null
  providerClassName: string | null
  internalClass: string
  nodata: boolean
  outsideCoverage: boolean
  geographicallyReasonable: boolean
  notes: string
}

export interface ClassAuditRow {
  code: number
  internalClass: string
  laeaPct: number
  laeaAreaSqkm: number
}

export interface LandCoverAuditReport {
  boundary: BoundaryAreaAudit
  nationalDistribution: ClassAuditRow[]
  manualSpotChecks: ManualSpotCheck[]
  manualSpotCheckWarnings: string[]
  classIntegrity: {
    source4326Codes: number[]
    laeaCodes: number[]
    unknownCodes: number[]
    pctSum: number
  }
}

function ringGeodesicAreaM2(ring: number[][]): number {
  let area = 0
  if (ring.length < 4) return 0
  for (let i = 0; i < ring.length - 1; i++) {
    const [lon1, lat1] = ring[i]
    const [lon2, lat2] = ring[i + 1]
    area +=
      (lon2 - lon1) * D2R *
      (2 + Math.sin(lat1 * D2R) + Math.sin(lat2 * D2R))
  }
  return Math.abs((area * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2)
}

function polygonGeodesicAreaM2(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  if (geometry.type === 'Polygon') {
    let area = ringGeodesicAreaM2(geometry.coordinates[0])
    for (let i = 1; i < geometry.coordinates.length; i++) {
      area -= ringGeodesicAreaM2(geometry.coordinates[i])
    }
    return area
  }
  return geometry.coordinates.reduce((sum, poly) => {
    let area = ringGeodesicAreaM2(poly[0])
    for (let i = 1; i < poly.length; i++) area -= ringGeodesicAreaM2(poly[i])
    return sum + area
  }, 0)
}

function readAdm0Geometry(): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  const fc = JSON.parse(readFileSync(GUATEMALA_ADM0_GEOJSON, 'utf8')) as GeoJSON.FeatureCollection
  const feature = fc.features[0]
  if (!feature?.geometry) throw new Error('ADM0 sin geometría')
  if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
    throw new Error('ADM0 con geometría inesperada')
  }
  return feature.geometry
}

function readHdxAreaSqkm(): number | null {
  const fc = JSON.parse(readFileSync(GUATEMALA_ADM0_GEOJSON, 'utf8')) as GeoJSON.FeatureCollection
  const value = fc.features[0]?.properties?.[GUATEMALA_BOUNDARY_AREA_SQKM_PROPERTY]
  return typeof value === 'number' ? value : null
}

async function computeLaeaBoundaryAreaSqkm(): Promise<number> {
  return withRasterTempWorkspace(async (ws) => {
    const laeaPath = ws.path('adm0_laea.geojson')
    const res = await runCommand('ogr2ogr', [
      '-overwrite',
      '-t_srs',
      LAEA_PROJ4,
      laeaPath,
      GUATEMALA_ADM0_GEOJSON,
    ])
    if (res.exitCode !== 0) {
      throw new Error(`ogr2ogr ADM0 LAEA falló: ${res.stderr || res.stdout}`)
    }
    const areaRes = await runCommand('ogrinfo', [
      '-dialect',
      'SQLite',
      '-sql',
      'SELECT ST_Area(geometry)/1e6 AS area_km2 FROM gtm_admin0',
      laeaPath,
    ])
    if (areaRes.exitCode !== 0) {
      throw new Error(`ogrinfo área LAEA falló: ${areaRes.stderr || areaRes.stdout}`)
    }
    const match = areaRes.stdout.match(/area_km2 \(Real\) = ([0-9.]+)/)
    if (!match?.[1]) throw new Error('No se pudo leer área LAEA del boundary')
    return Number(match[1])
  })
}

export const MANUAL_SPOT_CHECKS: Array<{
  name: string
  latitude: number
  longitude: number
  expectedClasses: string[]
  notes: string
}> = [
  {
    name: 'Petén central',
    latitude: 16.9,
    longitude: -90.5,
    expectedClasses: ['forest'],
    notes: 'Selva maya — dominancia bosque (verificado 10)',
  },
  {
    name: 'Costa sur agrícola',
    latitude: 14.0,
    longitude: -91.0,
    expectedClasses: ['cropland', 'grassland'],
    notes: 'Occidente costero — cultivo 40 (WorldCover 2021)',
  },
  {
    name: 'Altiplano',
    latitude: 15.03,
    longitude: -91.72,
    expectedClasses: ['shrubland', 'grassland', 'cropland', 'forest'],
    notes: 'Altiplano occidental — arbustal 20 admisible',
  },
  {
    name: 'Ciudad de Guatemala',
    latitude: 14.6349,
    longitude: -90.5069,
    expectedClasses: ['built_up'],
    notes: 'Área urbana capitalina (50)',
  },
  {
    name: 'Manglares Pacífico',
    latitude: 13.95,
    longitude: -90.65,
    expectedClasses: ['mangrove'],
    notes: 'Manchón costero — manglar 95 (verificado)',
  },
  {
    name: 'Lago de Atitlán',
    latitude: 14.7,
    longitude: -91.2,
    expectedClasses: ['permanent_water'],
    notes: 'Cuerpo de agua permanente (80)',
  },
  {
    name: 'Fuera de Guatemala',
    latitude: 15.0,
    longitude: -87.5,
    expectedClasses: ['unknown'],
    notes: 'Honduras — fuera de cobertura nacional',
  },
]

export async function runLandCoverAudit(): Promise<LandCoverAuditReport> {
  const geometry = readAdm0Geometry()
  const hdxAreaSqkmProperty = readHdxAreaSqkm()
  const geodesicAreaSqkm = polygonGeodesicAreaM2(geometry) / 1_000_000
  const laeaPlanarAreaSqkm = await computeLaeaBoundaryAreaSqkm()

  const laeaJson = await gdalInfoJson(LAND_COVER_ANALYTIC_COG)
  const laeaSummary = parseGdalInfoJson(LAND_COVER_ANALYTIC_COG, laeaJson)
  const laeaDistribution = distributionFromGdalSummary(laeaSummary)
  const rasterValidAreaSqkm = laeaDistribution.analyzedAreaHa / 100

  const boundaryReferenceSqkm = laeaPlanarAreaSqkm
  const rasterMinusBoundarySqkm = rasterValidAreaSqkm - boundaryReferenceSqkm
  const rasterMinusBoundaryPct =
    boundaryReferenceSqkm > 0 ? (rasterMinusBoundarySqkm / boundaryReferenceSqkm) * 100 : 0

  const masked = await withRasterTempWorkspace(async (ws) => {
    const laeaBoundary = ws.path('adm0_laea.geojson')
    await runCommand('ogr2ogr', [
      '-overwrite',
      '-t_srs',
      LAEA_PROJ4,
      laeaBoundary,
      GUATEMALA_ADM0_GEOJSON,
    ])
    return analyzeNationalRasterMasked({
      laeaPath: LAND_COVER_ANALYTIC_COG,
      boundaryPath: laeaBoundary,
      clipOutputPath: ws.path('national_mask_clip.tif'),
    })
  })

  const nodataInsideBoundaryPixels = masked.nodataPixelCount
  const validOutsideBoundaryPixels = Math.max(
    0,
    laeaSummary.valid_pixel_count - masked.validPixelCount,
  )
  const pixelAreaM2 =
    (laeaSummary.pixel_size?.[0] ?? 9.08) * (laeaSummary.pixel_size?.[1] ?? 9.08)
  const borderPixelImpactEstimateSqkm =
    (nodataInsideBoundaryPixels + validOutsideBoundaryPixels) * pixelAreaM2 / 1_000_000

  const sourceJson = await gdalInfoJson(LAND_COVER_SOURCE_COG)
  const sourceSummary = parseGdalInfoJson(LAND_COVER_SOURCE_COG, sourceJson)

  const nationalDistribution = masked.classDistribution.map((row) => ({
    code: row.providerClassCode,
    internalClass: row.internalClass,
    laeaPct: Math.round(row.pct * 10) / 10,
    laeaAreaSqkm: Math.round(((row.count * pixelAreaM2) / 1_000_000) * 10) / 10,
  }))

  const pctSum = nationalDistribution.reduce((s, r) => s + r.laeaPct, 0)

  const manualSpotChecks: ManualSpotCheck[] = []
  for (const spot of MANUAL_SPOT_CHECKS) {
    const sample = await samplePointFromRaster(LAND_COVER_SOURCE_COG, {
      lon: spot.longitude,
      lat: spot.latitude,
    })
    const reasonable = spot.expectedClasses.includes(sample.internalClass)
    manualSpotChecks.push({
      name: spot.name,
      latitude: spot.latitude,
      longitude: spot.longitude,
      providerClassCode: sample.providerClassCode,
      providerClassName: sample.providerClassName,
      internalClass: sample.internalClass,
      nodata: sample.nodata,
      outsideCoverage: sample.outsideCoverage,
      geographicallyReasonable: reasonable || (spot.name.includes('Fuera') && sample.outsideCoverage),
      notes: spot.notes,
    })
  }

  const unreasonable = manualSpotChecks.filter((s) => !s.geographicallyReasonable)

  return {
    boundary: {
      hdxAreaSqkmProperty,
      geodesicAreaSqkm: Math.round(geodesicAreaSqkm * 100) / 100,
      laeaPlanarAreaSqkm: Math.round(laeaPlanarAreaSqkm * 100) / 100,
      rasterValidAreaSqkm: Math.round(rasterValidAreaSqkm * 100) / 100,
      rasterMinusBoundarySqkm: Math.round(rasterMinusBoundarySqkm * 100) / 100,
      rasterMinusBoundaryPct: Math.round(rasterMinusBoundaryPct * 1000) / 1000,
      nodataInsideBoundaryPixels,
      validOutsideBoundaryPixels,
      borderPixelImpactEstimateSqkm: Math.round(borderPixelImpactEstimateSqkm * 100) / 100,
    },
    nationalDistribution,
    manualSpotChecks,
    classIntegrity: {
      source4326Codes: Object.keys(sourceSummary.class_histogram)
        .map(Number)
        .filter((c) => c > 0),
      laeaCodes: Object.keys(laeaSummary.class_histogram)
        .map(Number)
        .filter((c) => c > 0),
      unknownCodes: [
        ...new Set([
          ...sourceSummary.unknown_class_codes,
          ...laeaSummary.unknown_class_codes,
        ]),
      ],
      pctSum: Math.round(pctSum * 10) / 10,
    },
    manualSpotCheckWarnings:
      unreasonable.length > 0
        ? unreasonable.map((s) => `${s.name}: clase ${s.internalClass}`)
        : [],
  }
}

export function formatClassLabel(code: number): string {
  return mapEsaWorldCoverCode(code).internal_class
}
