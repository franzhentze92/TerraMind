import { existsSync, readFileSync } from 'node:fs'

import { createPopulationAdminService } from '@/modules/territory/population/admin/population-admin.service'
import type { AdminRasterComparison } from '@/modules/territory/population/admin/population-admin.types'
import {
  adm1PcodeToDepartmentCode,
  departmentCodeToAdm1Pcode,
} from '@/modules/territory/population/admin/population-admin-codes'
import { GUATEMALA_ADM0_GEOJSON, GUATEMALA_ADM1_GEOJSON } from '@/modules/territory/population/processing/paths'
import { INE_PROJECTION_REFERENCE_YEAR } from '@/modules/territory/population/providers/ine/ine-projection-2020-reference'
import { createPopulationRasterEngine } from '@/modules/territory/population/raster/population-raster-engine'

function loadAdm1Features(): GeoJSON.Feature[] {
  if (!existsSync(GUATEMALA_ADM1_GEOJSON)) return []
  const fc = JSON.parse(readFileSync(GUATEMALA_ADM1_GEOJSON, 'utf8')) as GeoJSON.FeatureCollection
  return fc.features ?? []
}

export async function compareAdministrativeUnitToRaster(input: {
  adminLevel: 'national' | 'department' | 'municipality'
  adminCode: string
  referenceYear?: number
}): Promise<AdminRasterComparison> {
  const adminService = createPopulationAdminService()
  const raster = createPopulationRasterEngine()
  const referenceYear = input.referenceYear ?? INE_PROJECTION_REFERENCE_YEAR

  let geometry: GeoJSON.Geometry | null = null
  if (input.adminLevel === 'national') {
    if (existsSync(GUATEMALA_ADM0_GEOJSON)) {
      const fc = JSON.parse(readFileSync(GUATEMALA_ADM0_GEOJSON, 'utf8')) as GeoJSON.FeatureCollection
      geometry = fc.features[0]?.geometry ?? null
    }
  } else if (input.adminLevel === 'department') {
    const pcode = departmentCodeToAdm1Pcode(input.adminCode)
    const feature = loadAdm1Features().find((f) => f.properties?.adm1_pcode === pcode)
    geometry = feature?.geometry ?? null
  }

  let constrainedSum: number | undefined
  let unconstrainedSum: number | undefined
  let coveragePct: number | undefined

  if (geometry && (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon')) {
    const [constrained, unconstrained] = await Promise.all([
      raster.analyzeGeometry({ geometry, variant: 'constrained' }),
      raster.analyzeGeometry({ geometry, variant: 'unconstrained' }),
    ])
    constrainedSum = constrained.result.populationSum
    unconstrainedSum = unconstrained.result.populationSum
    coveragePct = constrained.result.dataCoveragePct
  }

  return adminService.compareAdministrativeToRaster({
    adminLevel: input.adminLevel,
    adminCode: input.adminCode,
    referenceYear,
    rasterConstrainedSum: constrainedSum,
    rasterUnconstrainedSum: unconstrainedSum,
    coveragePct,
  })
}

export async function compareAllDepartmentsToRaster(
  referenceYear = INE_PROJECTION_REFERENCE_YEAR,
): Promise<AdminRasterComparison[]> {
  const features = loadAdm1Features()
  const comparisons: AdminRasterComparison[] = []

  if (features.length > 0) {
    for (const feature of features) {
      const pcode = String(feature.properties?.adm1_pcode ?? '')
      const deptCode = adm1PcodeToDepartmentCode(pcode)
      comparisons.push(
        await compareAdministrativeUnitToRaster({
          adminLevel: 'department',
          adminCode: deptCode,
          referenceYear,
        }),
      )
    }
    return comparisons
  }

  const { loadAdminStatisticsFromDisk } = await import(
    '@/modules/territory/population/providers/ine/ine-import-builder'
  )
  const adminService = createPopulationAdminService()
  for (const record of loadAdminStatisticsFromDisk().filter(
    (r) => r.adminLevel === 'department' && r.statisticType === 'projection',
  )) {
    comparisons.push(
      await adminService.compareAdministrativeToRaster({
        adminLevel: 'department',
        adminCode: record.adminCode,
        referenceYear,
      }),
    )
  }

  return comparisons
}

export async function compareNationalToRaster(
  referenceYear = INE_PROJECTION_REFERENCE_YEAR,
): Promise<AdminRasterComparison> {
  return compareAdministrativeUnitToRaster({
    adminLevel: 'national',
    adminCode: 'GT',
    referenceYear,
  })
}
