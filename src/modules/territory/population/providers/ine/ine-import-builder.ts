import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  adm1PcodeToDepartmentCode,
  adm2PcodeToMunicipalityCode,
  departmentCodeToAdm1Pcode,
  inferDepartmentFromMunicipalityCode,
  normalizeAdminName,
} from '@/modules/territory/population/admin/population-admin-codes'
import type {
  AdminPopulationRecord,
  IneImportDryRunReport,
  SettlementRecord,
} from '@/modules/territory/population/admin/population-admin.types'
import { INE_DEPARTMENT_CENSUS_2018 } from '@/modules/territory/population/providers/ine/ine-census-2018-departments'
import {
  INE_NATIONAL_POPULATION_2018,
  INE_REFERENCE_TOTALS,
  INE_SOURCE_CODE,
} from '@/modules/territory/population/providers/ine/ine.manifest'
import {
  INE_DEPARTMENT_PROJECTIONS_2020,
  INE_NATIONAL_PROJECTION_2020,
  INE_PROJECTION_REFERENCE_YEAR,
} from '@/modules/territory/population/providers/ine/ine-projection-2020-reference'

export const INE_DATA_DIR = resolve(process.cwd(), 'data/population/ine')
export const INE_PROCESSED_DIR = resolve(INE_DATA_DIR, 'processed')
export const INE_ADMIN_STATS_PATH = resolve(INE_PROCESSED_DIR, 'admin_statistics.json')
export const INE_SETTLEMENTS_PATH = resolve(INE_PROCESSED_DIR, 'settlements.json')
export const INE_MANIFEST_PATH = resolve(INE_DATA_DIR, 'manifest.json')

const HDX_ADMINPOINTS = resolve(
  process.cwd(),
  'data/geo/sources/hdx-cod-ab-guatemala/2025-10-30-v01/extracted/gtm_adminpoints.geojson',
)

export function buildAdminStatisticsRecords(): AdminPopulationRecord[] {
  const records: AdminPopulationRecord[] = []

  records.push({
    adminLevel: 'national',
    adminCode: 'GT',
    adminName: 'Guatemala',
    statisticType: 'census',
    referenceYear: 2018,
    populationTotal: INE_NATIONAL_POPULATION_2018,
    isCensus: true,
    isProjection: false,
    temporalAlignment: 'exact',
    source: INE_SOURCE_CODE,
  })

  records.push({
    adminLevel: 'national',
    adminCode: 'GT',
    adminName: 'Guatemala',
    statisticType: 'projection',
    referenceYear: INE_PROJECTION_REFERENCE_YEAR,
    populationTotal: INE_NATIONAL_PROJECTION_2020,
    isCensus: false,
    isProjection: true,
    temporalAlignment: 'exact',
    source: INE_SOURCE_CODE,
    projectionMethod: 'INE proyecciones departamentales 2010-2050',
  })

  for (const dept of INE_DEPARTMENT_CENSUS_2018) {
    records.push({
      adminLevel: 'department',
      adminCode: adm1PcodeToDepartmentCode(dept.adm1Pcode),
      departmentCode: adm1PcodeToDepartmentCode(dept.adm1Pcode),
      adminName: dept.departmentName,
      statisticType: 'census',
      referenceYear: 2018,
      populationTotal: dept.population2018,
      isCensus: true,
      isProjection: false,
      temporalAlignment: 'exact',
      source: INE_SOURCE_CODE,
    })
  }

  for (const dept of INE_DEPARTMENT_PROJECTIONS_2020) {
    records.push({
      adminLevel: 'department',
      adminCode: adm1PcodeToDepartmentCode(dept.adm1Pcode),
      departmentCode: adm1PcodeToDepartmentCode(dept.adm1Pcode),
      adminName: dept.departmentName,
      statisticType: 'projection',
      referenceYear: INE_PROJECTION_REFERENCE_YEAR,
      populationTotal: dept.population2020,
      isCensus: false,
      isProjection: true,
      temporalAlignment: 'exact',
      source: INE_SOURCE_CODE,
      projectionMethod: 'INE proyecciones departamentales 2010-2050',
    })
  }

  const municipalitySamples: Array<{ code: string; name: string; pop: number; year: 2018 }> = [
    { code: '0101', name: 'Guatemala', pop: INE_REFERENCE_TOTALS.guatemala_municipality_2018, year: 2018 },
    { code: '1107', name: 'Champerico', pop: INE_REFERENCE_TOTALS.champerico_municipality_2018, year: 2018 },
  ]

  for (const muni of municipalitySamples) {
    records.push({
      adminLevel: 'municipality',
      adminCode: muni.code,
      departmentCode: inferDepartmentFromMunicipalityCode(muni.code),
      municipalityCode: muni.code,
      adminName: muni.name,
      statisticType: 'census',
      referenceYear: muni.year,
      populationTotal: muni.pop,
      isCensus: true,
      isProjection: false,
      temporalAlignment: 'partial',
      source: INE_SOURCE_CODE,
    })
  }

  return records
}

export function buildSettlementRecordsFromHdx(): SettlementRecord[] {
  if (!existsSync(HDX_ADMINPOINTS)) {
    return []
  }
  const fc = JSON.parse(readFileSync(HDX_ADMINPOINTS, 'utf8')) as GeoJSON.FeatureCollection
  const settlements: SettlementRecord[] = []

  for (const feature of fc.features) {
    const props = feature.properties ?? {}
    const adminLevel = Number(props.admin_level ?? 0)
    if (adminLevel !== 2) continue
    if (feature.geometry?.type !== 'Point') continue
    const coords = feature.geometry.coordinates
    const adm2Pcode = String(props.adm2_pcode ?? '')
    const municipalityCode = adm2Pcode ? adm2PcodeToMunicipalityCode(adm2Pcode) : undefined
    settlements.push({
      sourceSettlementId: adm2Pcode || String(props.name ?? ''),
      name: String(props.name ?? props.adm2_name ?? 'Sin nombre'),
      normalizedName: normalizeAdminName(String(props.name ?? props.adm2_name ?? '')),
      settlementType: 'municipal_seat',
      departmentCode: props.adm1_pcode
        ? adm1PcodeToDepartmentCode(String(props.adm1_pcode))
        : municipalityCode
          ? inferDepartmentFromMunicipalityCode(municipalityCode)
          : undefined,
      municipalityCode,
      departmentName: props.adm1_name ? String(props.adm1_name) : undefined,
      municipalityName: props.adm2_name ? String(props.adm2_name) : undefined,
      lat: coords[1]!,
      lon: coords[0]!,
      locationAccuracy: 'admin_centroid',
      source: 'hdx_cod_ab_complement',
    })
  }

  return settlements
}

export function validateAdminRecords(records: AdminPopulationRecord[]): string[] {
  const warnings: string[] = []
  const deptCensus = records.filter(
    (r) => r.adminLevel === 'department' && r.statisticType === 'census',
  )
  if (deptCensus.length !== 22) {
    warnings.push(`Departamentos censo: esperados 22, encontrados ${deptCensus.length}`)
  }

  const deptSum = deptCensus.reduce((s, r) => s + r.populationTotal, 0)
  if (deptSum !== INE_NATIONAL_POPULATION_2018) {
    warnings.push(
      `Suma departamental censo (${deptSum}) ≠ nacional (${INE_NATIONAL_POPULATION_2018}); Δ ${deptSum - INE_NATIONAL_POPULATION_2018}`,
    )
  }

  const codes = new Set<string>()
  for (const r of records) {
    const key = `${r.adminLevel}|${r.adminCode}|${r.statisticType}|${r.referenceYear}`
    if (codes.has(key)) warnings.push(`Duplicado: ${key}`)
    codes.add(key)
    if (r.populationTotal < 0) warnings.push(`Población negativa: ${key}`)
  }

  return warnings
}

export function runIneImport(mode: 'dry-run' | 'apply'): IneImportDryRunReport {
  const adminStatistics = buildAdminStatisticsRecords()
  const settlements = buildSettlementRecordsFromHdx()
  const warnings = validateAdminRecords(adminStatistics)

  const checksum = createHash('sha256')
    .update(JSON.stringify({ adminStatistics, settlements }))
    .digest('hex')

  const report: IneImportDryRunReport = {
    mode,
    sources: 2,
    adminStatistics: {
      inserted: adminStatistics.length,
      updated: 0,
      unchanged: 0,
      rejected: 0,
      duplicates: 0,
    },
    crosswalk: { inserted: adminStatistics.filter((r) => r.adminLevel !== 'national').length },
    settlements: {
      inserted: settlements.length,
      rejected: settlements.length === 0 ? 1 : 0,
    },
    warnings,
    checksum,
  }

  if (mode === 'apply') {
    mkdirSync(INE_PROCESSED_DIR, { recursive: true })
    writeFileSync(INE_ADMIN_STATS_PATH, `${JSON.stringify(adminStatistics, null, 2)}\n`, 'utf8')
    writeFileSync(INE_SETTLEMENTS_PATH, `${JSON.stringify(settlements, null, 2)}\n`, 'utf8')
    writeFileSync(
      INE_MANIFEST_PATH,
      `${JSON.stringify(
        {
          imported_at: new Date().toISOString(),
          checksum,
          admin_records: adminStatistics.length,
          settlements: settlements.length,
          warnings,
        },
        null,
        2,
      )}\n`,
      'utf8',
    )
  }

  return report
}

export function loadAdminStatisticsFromDisk(): AdminPopulationRecord[] {
  if (!existsSync(INE_ADMIN_STATS_PATH)) {
    return buildAdminStatisticsRecords()
  }
  return JSON.parse(readFileSync(INE_ADMIN_STATS_PATH, 'utf8')) as AdminPopulationRecord[]
}

export function loadSettlementsFromDisk(): SettlementRecord[] {
  if (!existsSync(INE_SETTLEMENTS_PATH)) {
    return buildSettlementRecordsFromHdx()
  }
  return JSON.parse(readFileSync(INE_SETTLEMENTS_PATH, 'utf8')) as SettlementRecord[]
}

export function resolveDepartmentCode(input: string): string {
  if (/^GT\d{2}$/i.test(input)) return adm1PcodeToDepartmentCode(input)
  return input.padStart(2, '0')
}

export function resolveMunicipalityCode(input: string): string {
  if (/^GT\d{4}$/i.test(input)) return adm2PcodeToMunicipalityCode(input)
  return input.padStart(4, '0')
}

export { departmentCodeToAdm1Pcode }
