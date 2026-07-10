import type { AdminPopulationRecord } from '@/modules/territory/population/admin/population-admin.types'
import type { PopulationAdminStore } from '@/modules/territory/population/admin/population-admin.service'
import {
  adm1PcodeToDepartmentCode,
  adm2PcodeToMunicipalityCode,
} from '@/modules/territory/population/admin/population-admin-codes'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

function mapRow(row: Record<string, unknown>): AdminPopulationRecord {
  return {
    adminLevel: row.admin_level as AdminPopulationRecord['adminLevel'],
    adminCode: String(row.admin_code),
    departmentCode: row.department_code ? String(row.department_code) : undefined,
    municipalityCode: row.municipality_code ? String(row.municipality_code) : undefined,
    adminName: String(row.admin_name),
    statisticType: row.statistic_type as AdminPopulationRecord['statisticType'],
    referenceYear: Number(row.reference_year),
    populationTotal: Number(row.population_total),
    populationUrban: row.population_urban != null ? Number(row.population_urban) : undefined,
    populationRural: row.population_rural != null ? Number(row.population_rural) : undefined,
    isCensus: Boolean(row.is_census),
    isProjection: Boolean(row.is_projection),
    temporalAlignment: row.temporal_alignment as AdminPopulationRecord['temporalAlignment'],
    source: 'ine_guatemala',
    projectionMethod: row.projection_method ? String(row.projection_method) : undefined,
  }
}

export function createSupabasePopulationAdminStore(): PopulationAdminStore {
  let cache: AdminPopulationRecord[] | null = null

  async function load(): Promise<AdminPopulationRecord[]> {
    if (cache) return cache
    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase.from('population_admin_statistics').select('*')
    if (error) throw new Error(error.message)
    cache = (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
    return cache
  }

  return {
    isAvailable() {
      return true
    },
    listRecords() {
      if (!cache) {
        throw new Error('Supabase admin store: llamar warmPopulationAdminCache() primero')
      }
      return cache
    },
    getNational(referenceYear, statisticType) {
      return (
        cache?.find(
          (r) =>
            r.adminLevel === 'national' &&
            r.referenceYear === referenceYear &&
            r.statisticType === statisticType,
        ) ?? null
      )
    },
    getDepartment(departmentCode, referenceYear, statisticType) {
      const code = departmentCode.padStart(2, '0')
      return (
        cache?.find(
          (r) =>
            r.adminLevel === 'department' &&
            r.adminCode === code &&
            r.referenceYear === referenceYear &&
            r.statisticType === statisticType,
        ) ?? null
      )
    },
    getMunicipality(municipalityCode, referenceYear, statisticType) {
      const code = municipalityCode.padStart(4, '0')
      return (
        cache?.find(
          (r) =>
            r.adminLevel === 'municipality' &&
            r.adminCode === code &&
            r.referenceYear === referenceYear &&
            r.statisticType === statisticType,
        ) ?? null
      )
    },
    async _warm() {
      await load()
    },
  } as PopulationAdminStore & { _warm(): Promise<void> }
}

export async function warmPopulationAdminCache(
  store: PopulationAdminStore,
): Promise<PopulationAdminStore> {
  const maybe = store as PopulationAdminStore & { _warm?: () => Promise<void> }
  if (maybe._warm) await maybe._warm()
  return store
}

export function resolveDepartmentCode(input: string): string {
  if (/^GT\d{2}$/i.test(input)) return adm1PcodeToDepartmentCode(input)
  return input.padStart(2, '0')
}

export function resolveMunicipalityCode(input: string): string {
  if (/^GT\d{4}$/i.test(input)) return adm2PcodeToMunicipalityCode(input)
  return input.padStart(4, '0')
}
