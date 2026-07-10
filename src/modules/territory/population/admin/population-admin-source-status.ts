import { readFileSync } from 'node:fs'
import { existsSync } from 'node:fs'

import {
  INE_ADMIN_STATS_PATH,
  INE_MANIFEST_PATH,
  INE_SETTLEMENTS_PATH,
  loadAdminStatisticsFromDisk,
  loadSettlementsFromDisk,
} from '@/modules/territory/population/providers/ine/ine-import-builder'
import { INE_PROJECTION_REFERENCE_YEAR } from '@/modules/territory/population/providers/ine/ine-projection-2020-reference'
import { INE_SOURCE_CODE } from '@/modules/territory/population/providers/ine/ine.manifest'
import { populationWarning } from '@/modules/territory/population/population-warnings'
import type { PopulationWarning } from '@/modules/territory/population/population.types'
import { WORLDPOP_REFERENCE_YEAR } from '@/modules/territory/population/providers/worldpop/worldpop.manifest'

export interface IneAdminSourceStatus {
  sourceCode: string
  available: boolean
  referenceYears: number[]
  adminLevels: Array<'national' | 'department' | 'municipality'>
  recordCount: number
  latestReferenceYear: number
  temporalAlignmentWithWorldPop: 'exact' | 'partial' | 'mismatch'
  validationWarnings: string[]
  warnings: PopulationWarning[]
}

export interface SettlementSourceStatus {
  source: string
  recordCount: number
  coverage: 'national_municipal_seats' | 'none'
  latestUpdate?: string
  geometryHealth: 'healthy' | 'degraded' | 'unavailable'
  warnings: PopulationWarning[]
}

export interface PopulationAdminSourcesStatus {
  ine: IneAdminSourceStatus
  settlements: SettlementSourceStatus
}

export function getPopulationAdminSourcesStatus(): PopulationAdminSourcesStatus {
  const warnings: PopulationWarning[] = []
  const records = loadAdminStatisticsFromDisk()
  const settlements = loadSettlementsFromDisk()
  const imported = existsSync(INE_ADMIN_STATS_PATH)
  const referenceYears = [...new Set(records.map((r) => r.referenceYear))].sort((a, b) => a - b)
  const adminLevels = [...new Set(records.map((r) => r.adminLevel))] as IneAdminSourceStatus['adminLevels']

  const validationWarnings: string[] = []
  const deptProjection = records.filter(
    (r) => r.adminLevel === 'department' && r.statisticType === 'projection',
  )
  if (deptProjection.length !== 22) {
    validationWarnings.push(`Proyecciones departamentales: ${deptProjection.length}/22`)
  }
  if (!referenceYears.includes(INE_PROJECTION_REFERENCE_YEAR)) {
    validationWarnings.push(`Sin proyección ${INE_PROJECTION_REFERENCE_YEAR}`)
  }

  let temporalAlignment: IneAdminSourceStatus['temporalAlignmentWithWorldPop'] = 'mismatch'
  if (referenceYears.includes(WORLDPOP_REFERENCE_YEAR)) {
    temporalAlignment = 'exact'
  } else if (referenceYears.some((y) => Math.abs(y - WORLDPOP_REFERENCE_YEAR) <= 2)) {
    temporalAlignment = 'partial'
  }

  if (!imported) {
    warnings.push(
      populationWarning(
        'settlement_source_unavailable',
        'Estadísticas INE en memoria; ejecutar population:import-ine --apply.',
      ),
    )
  }

  const settlementWarnings: PopulationWarning[] = []
  let geometryHealth: SettlementSourceStatus['geometryHealth'] = 'unavailable'
  if (settlements.length > 0) {
    const valid = settlements.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    geometryHealth = valid.length === settlements.length ? 'healthy' : 'degraded'
    if (valid.length < settlements.length) {
      settlementWarnings.push(
        populationWarning('settlement_source_unavailable', 'Asentamientos con coordenadas inválidas.'),
      )
    }
  } else {
    settlementWarnings.push(
      populationWarning('settlement_source_unavailable', 'Sin asentamientos importados.'),
    )
  }

  let latestUpdate: string | undefined
  if (existsSync(INE_MANIFEST_PATH)) {
    try {
      const manifest = JSON.parse(readFileSync(INE_MANIFEST_PATH, 'utf8')) as {
        imported_at?: string
      }
      latestUpdate = manifest.imported_at
    } catch {
      /* ignore */
    }
  }

  return {
    ine: {
      sourceCode: INE_SOURCE_CODE,
      available: records.length > 0,
      referenceYears,
      adminLevels,
      recordCount: records.length,
      latestReferenceYear: referenceYears[referenceYears.length - 1] ?? 0,
      temporalAlignmentWithWorldPop: temporalAlignment,
      validationWarnings,
      warnings,
    },
    settlements: {
      source: settlements[0]?.source ?? 'none',
      recordCount: settlements.length,
      coverage: settlements.length > 0 ? 'national_municipal_seats' : 'none',
      latestUpdate,
      geometryHealth,
      warnings: settlementWarnings,
    },
  }
}
