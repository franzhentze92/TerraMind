import { existsSync } from 'node:fs'

import { buildAdminRasterComparison } from '@/modules/territory/population/admin/population-admin-compare'
import { departmentCodeToAdm1Pcode } from '@/modules/territory/population/admin/population-admin-codes'
import {
  createSupabasePopulationAdminStore,
  warmPopulationAdminCache,
} from '@/modules/territory/population/admin/population-admin-supabase.store'
import {
  countPopulationAdminInSupabase,
} from '@/modules/territory/population/providers/ine/population-supabase-seed'
import {
  INE_ADMIN_STATS_PATH,
  loadAdminStatisticsFromDisk,
  loadSettlementsFromDisk,
  resolveDepartmentCode,
  resolveMunicipalityCode,
} from '@/modules/territory/population/providers/ine/ine-import-builder'
import type {
  AdminPopulationRecord,
  AdminRasterComparison,
} from '@/modules/territory/population/admin/population-admin.types'
import {
  INE_PROJECTION_REFERENCE_YEAR,
  INE_PROJECTION_SOURCE,
} from '@/modules/territory/population/providers/ine/ine-projection-2020-reference'
import {
  INE_ATTRIBUTION,
  INE_SOURCE_CODE,
} from '@/modules/territory/population/providers/ine/ine.manifest'
import type {
  AdministrativePopulationContext,
  AdministrativeUnitPopulation,
  GetAdministrativeContextInput,
  PopulationWarning,
} from '@/modules/territory/population/population.types'
import { populationWarning } from '@/modules/territory/population/population-warnings'
import { WORLDPOP_REFERENCE_YEAR } from '@/modules/territory/population/providers/worldpop/worldpop.manifest'

export interface PopulationAdminStore {
  isAvailable(): boolean
  listRecords(): AdminPopulationRecord[]
  getNational(referenceYear: number, statisticType: 'census' | 'projection'): AdminPopulationRecord | null
  getDepartment(
    departmentCode: string,
    referenceYear: number,
    statisticType: 'census' | 'projection',
  ): AdminPopulationRecord | null
  getMunicipality(
    municipalityCode: string,
    referenceYear: number,
    statisticType: 'census' | 'projection',
  ): AdminPopulationRecord | null
}

export class PopulationAdminServiceNotReadyError extends Error {
  constructor(message = 'PopulationAdminService: datos INE no importados (7D.2).') {
    super(message)
    this.name = 'PopulationAdminServiceNotReadyError'
  }
}

export interface PopulationAdminService {
  getNationalPopulation(input: {
    referenceYear: number
    statisticType: 'census' | 'projection'
  }): Promise<AdminPopulationRecord | null>
  getDepartmentPopulation(input: {
    departmentCode: string
    referenceYear: number
    statisticType: 'census' | 'projection'
  }): Promise<AdminPopulationRecord | null>
  getMunicipalityPopulation(input: {
    municipalityCode: string
    referenceYear: number
    statisticType: 'census' | 'projection'
  }): Promise<AdminPopulationRecord | null>
  listAvailableReferenceYears(): Promise<number[]>
  listAvailableStatistics(): Promise<Array<'census' | 'projection'>>
  getAdministrativeHierarchy(input: {
    departmentCode?: string
    municipalityCode?: string
  }): Promise<{ department?: AdminPopulationRecord; municipality?: AdminPopulationRecord }>
  compareAdministrativeToRaster(input: {
    adminLevel: 'national' | 'department' | 'municipality'
    adminCode: string
    referenceYear: number
    rasterConstrainedSum?: number
    rasterUnconstrainedSum?: number
    coveragePct?: number
  }): Promise<AdminRasterComparison>
  getAdministrativeContext(
    input: GetAdministrativeContextInput,
  ): Promise<AdministrativePopulationContext>
  getStoreStatus(): {
    available: boolean
    recordCount: number
    settlementCount: number
    latestReferenceYear: number
    temporalAlignmentWithWorldPop: 'exact' | 'partial' | 'mismatch'
  }
}

function toUnitPopulation(record: AdminPopulationRecord): AdministrativeUnitPopulation {
  return {
    adminCode: record.adminCode,
    adminName: record.adminName,
    adminLevel: record.adminLevel === 'municipality' ? 'municipality' : 'department',
    officialPopulation: record.populationTotal,
    urbanPopulation: record.populationUrban,
    ruralPopulation: record.populationRural,
    households: record.households,
    projectionYear: record.isProjection ? record.referenceYear : undefined,
    source: INE_SOURCE_CODE,
    referenceYear: record.referenceYear,
  }
}

function pickRecordForYear(
  records: AdminPopulationRecord[],
  preferredYear: number,
): { record: AdminPopulationRecord | null; alignment: 'exact' | 'nearest' | 'mismatch' } {
  const exact = records.find((r) => r.referenceYear === preferredYear)
  if (exact) return { record: exact, alignment: 'exact' }
  const projection2020 = records.find(
    (r) => r.statisticType === 'projection' && r.referenceYear === INE_PROJECTION_REFERENCE_YEAR,
  )
  if (projection2020 && preferredYear === WORLDPOP_REFERENCE_YEAR) {
    return { record: projection2020, alignment: 'exact' }
  }
  const nearest = [...records].sort(
    (a, b) => Math.abs(a.referenceYear - preferredYear) - Math.abs(b.referenceYear - preferredYear),
  )[0]
  if (!nearest) return { record: null, alignment: 'mismatch' }
  return { record: nearest, alignment: 'nearest' }
}

export function createLocalPopulationAdminStore(): PopulationAdminStore {
  const records = loadAdminStatisticsFromDisk()
  return {
    isAvailable: () => existsSync(INE_ADMIN_STATS_PATH) || records.length > 0,
    listRecords: () => records,
    getNational(referenceYear, statisticType) {
      return (
        records.find(
          (r) =>
            r.adminLevel === 'national' &&
            r.referenceYear === referenceYear &&
            r.statisticType === statisticType,
        ) ?? null
      )
    },
    getDepartment(departmentCode, referenceYear, statisticType) {
      const code = resolveDepartmentCode(departmentCode)
      return (
        records.find(
          (r) =>
            r.adminLevel === 'department' &&
            r.adminCode === code &&
            r.referenceYear === referenceYear &&
            r.statisticType === statisticType,
        ) ?? null
      )
    },
    getMunicipality(municipalityCode, referenceYear, statisticType) {
      const code = resolveMunicipalityCode(municipalityCode)
      return (
        records.find(
          (r) =>
            r.adminLevel === 'municipality' &&
            r.adminCode === code &&
            r.referenceYear === referenceYear &&
            r.statisticType === statisticType,
        ) ?? null
      )
    },
  }
}

export function createPopulationAdminService(
  store: PopulationAdminStore = createLocalPopulationAdminStore(),
): PopulationAdminService {
  return {
    getStoreStatus() {
      const records = store.listRecords()
      const years = [...new Set(records.map((r) => r.referenceYear))].sort((a, b) => b - a)
      return {
        available: store.isAvailable(),
        recordCount: records.length,
        settlementCount: loadSettlementsFromDisk().length,
        latestReferenceYear: years[0] ?? 0,
        temporalAlignmentWithWorldPop: years.includes(WORLDPOP_REFERENCE_YEAR)
          ? 'exact'
          : 'partial',
      }
    },

    async getNationalPopulation(input) {
      return store.getNational(input.referenceYear, input.statisticType)
    },

    async getDepartmentPopulation(input) {
      return store.getDepartment(input.departmentCode, input.referenceYear, input.statisticType)
    },

    async getMunicipalityPopulation(input) {
      return store.getMunicipality(
        input.municipalityCode,
        input.referenceYear,
        input.statisticType,
      )
    },

    async listAvailableReferenceYears() {
      return [...new Set(store.listRecords().map((r) => r.referenceYear))].sort((a, b) => a - b)
    },

    async listAvailableStatistics() {
      return [...new Set(store.listRecords().map((r) => r.statisticType))] as Array<
        'census' | 'projection'
      >
    },

    async getAdministrativeHierarchy(input) {
      const deptCode = input.departmentCode ? resolveDepartmentCode(input.departmentCode) : undefined
      const muniCode = input.municipalityCode
        ? resolveMunicipalityCode(input.municipalityCode)
        : undefined
      return {
        department: deptCode
          ? store.getDepartment(deptCode, INE_PROJECTION_REFERENCE_YEAR, 'projection') ??
            store.getDepartment(deptCode, 2018, 'census') ??
            undefined
          : undefined,
        municipality: muniCode
          ? store.getMunicipality(muniCode, 2018, 'census') ?? undefined
          : undefined,
      }
    },

    async compareAdministrativeToRaster(input) {
      let record: AdminPopulationRecord | null = null
      if (input.adminLevel === 'national') {
        record = store.getNational(input.referenceYear, 'projection')
      } else if (input.adminLevel === 'department') {
        record = store.getDepartment(input.adminCode, input.referenceYear, 'projection')
      } else {
        record = store.getMunicipality(input.adminCode, input.referenceYear, 'census')
      }
      if (!record) {
        throw new PopulationAdminServiceNotReadyError(
          `Sin dato oficial para ${input.adminLevel} ${input.adminCode} año ${input.referenceYear}`,
        )
      }
      return buildAdminRasterComparison({
        adminLevel: input.adminLevel,
        adminCode: input.adminCode,
        adminName: record.adminName,
        officialPopulation: record.populationTotal,
        officialReferenceYear: record.referenceYear,
        statisticType: record.statisticType,
        temporalAlignment: record.temporalAlignment,
        rasterConstrainedSum: input.rasterConstrainedSum,
        rasterUnconstrainedSum: input.rasterUnconstrainedSum,
        coveragePct: input.coveragePct,
      })
    },

    async getAdministrativeContext(input) {
      const preferredYear = input.referenceYear ?? WORLDPOP_REFERENCE_YEAR
      const warnings: PopulationWarning[] = []
      let status: AdministrativePopulationContext['status'] = 'not_available'

      if (!store.isAvailable()) {
        return {
          status: 'not_available',
          reason: 'INE administrative data not imported',
          source: INE_SOURCE_CODE,
          referenceYear: preferredYear,
          semantics: 'official_administrative_population',
        }
      }

      let department: AdministrativeUnitPopulation | undefined
      let municipality: AdministrativeUnitPopulation | undefined
      let temporalAlignment: AdministrativePopulationContext['temporalAlignment'] = 'mismatch'

      if (input.departmentCode) {
        const code = resolveDepartmentCode(input.departmentCode)
        const deptRecords = store
          .listRecords()
          .filter((r) => r.adminLevel === 'department' && r.adminCode === code)
        const picked = pickRecordForYear(deptRecords, preferredYear)
        if (picked.record) {
          department = toUnitPopulation(picked.record)
          temporalAlignment = picked.alignment
          status = 'available'
        }
        if (picked.alignment === 'nearest' && picked.record?.referenceYear !== preferredYear) {
          warnings.push(
            populationWarning(
              'outdated_reference_year',
              `Dato departamental ${picked.record?.referenceYear} usado como referencia para año solicitado ${preferredYear}.`,
            ),
          )
        }
      }

      if (input.municipalityCode) {
        const code = resolveMunicipalityCode(input.municipalityCode)
        const muniRecords = store
          .listRecords()
          .filter((r) => r.adminLevel === 'municipality' && r.adminCode === code)
        const picked = pickRecordForYear(muniRecords, preferredYear)
        if (picked.record) {
          municipality = toUnitPopulation(picked.record)
          status = municipality ? 'partial' : status
          if (picked.record.referenceYear !== preferredYear) {
            warnings.push(
              populationWarning(
                'official_year_mismatch' as PopulationWarning['code'],
                `Municipio solo disponible en censo ${picked.record.referenceYear}; no hay proyección municipal ${preferredYear}.`,
              ),
            )
            temporalAlignment = 'mismatch'
          }
        } else {
          warnings.push(
            populationWarning(
              'missing_admin_code',
              `Sin cifra municipal para ${code}.`,
            ),
          )
        }
      }

      if (!input.departmentCode && !input.municipalityCode) {
        throw new PopulationAdminServiceNotReadyError('Código administrativo requerido.')
      }

      return {
        status,
        reason: status === 'not_available' ? 'Sin registros para los códigos solicitados' : undefined,
        department,
        municipality,
        officialPopulation: municipality?.officialPopulation ?? department?.officialPopulation,
        projectionYear: department?.projectionYear ?? municipality?.projectionYear,
        source: INE_SOURCE_CODE,
        referenceYear: department?.referenceYear ?? municipality?.referenceYear ?? preferredYear,
        semantics: 'official_administrative_population',
        temporalAlignment,
        warnings: warnings.length ? warnings : undefined,
      }
    },
  }
}

export { INE_ATTRIBUTION, INE_PROJECTION_SOURCE, departmentCodeToAdm1Pcode }

/**
 * Factor municipal INE/raster — solo cuando años coinciden (7D.2: no aplicar aún).
 */
export function computeMunicipalAdjustmentFactor(
  officialPopulation: number,
  rasterSum: number,
  officialYear: number,
  rasterYear: number,
): number | null {
  if (officialYear !== rasterYear) return null
  if (!Number.isFinite(rasterSum) || rasterSum <= 0) return null
  return officialPopulation / rasterSum
}

let cachedAdminService: PopulationAdminService | null = null

function hasSupabaseEnv(): boolean {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}

/**
 * Runtime store: Supabase si hay datos sembrados; JSON local solo como fallback de desarrollo.
 */
export async function resolvePopulationAdminStore(): Promise<PopulationAdminStore> {
  if (hasSupabaseEnv()) {
    try {
      const count = await countPopulationAdminInSupabase()
      if (count >= 40) {
        const store = createSupabasePopulationAdminStore()
        await warmPopulationAdminCache(store)
        return store
      }
    } catch {
      /* fallback local */
    }
  }
  return createLocalPopulationAdminStore()
}

export async function resolvePopulationAdminService(): Promise<PopulationAdminService> {
  if (cachedAdminService) return cachedAdminService
  const store = await resolvePopulationAdminStore()
  cachedAdminService = createPopulationAdminService(store)
  return cachedAdminService
}
