import {
  buildAdminStatisticsRecords,
  buildSettlementRecordsFromHdx,
} from '@/modules/territory/population/providers/ine/ine-import-builder'
import { INE_SOURCE_CODE } from '@/modules/territory/population/providers/ine/ine.manifest'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

export interface PopulationSupabaseSeedReport {
  mode: 'dry-run' | 'apply'
  sources: { inserted: number; updated: number }
  adminStatistics: { inserted: number; updated: number; unchanged: number }
  settlements: { inserted: number; updated: number; unchanged: number }
  checksum: string
}

async function upsertSource(input: {
  source_code: string
  name: string
  organization: string
  source_version: string
  reference_year: number
  is_official: boolean
  license: string
  attribution: string
}): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('population_sources')
    .upsert(
      {
        source_code: input.source_code,
        name: input.name,
        organization: input.organization,
        source_version: input.source_version,
        reference_year: input.reference_year,
        is_official: input.is_official,
        license: input.license,
        attribution: input.attribution,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_code' },
    )
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

export async function seedPopulationAdminToSupabase(
  mode: 'dry-run' | 'apply',
): Promise<PopulationSupabaseSeedReport> {
  const adminRecords = buildAdminStatisticsRecords()
  const settlements = buildSettlementRecordsFromHdx()

  const report: PopulationSupabaseSeedReport = {
    mode,
    sources: { inserted: 0, updated: 0 },
    adminStatistics: { inserted: 0, updated: 0, unchanged: 0 },
    settlements: { inserted: 0, updated: 0, unchanged: 0 },
    checksum: `${adminRecords.length}:${settlements.length}`,
  }

  if (mode === 'dry-run') {
    report.sources.inserted = 2
    report.adminStatistics.inserted = adminRecords.length
    report.settlements.inserted = settlements.length
    return report
  }

  const ineSourceId = await upsertSource({
    source_code: INE_SOURCE_CODE,
    name: 'INE Guatemala — Censo y proyecciones',
    organization: 'INE Guatemala',
    source_version: 'census-2018-projection-2020',
    reference_year: 2020,
    is_official: true,
    license: 'public-institutional',
    attribution: 'INE Guatemala',
  })
  report.sources.inserted += 1

  const hdxSourceId = await upsertSource({
    source_code: 'hdx_cod_ab_complement',
    name: 'HDX COD-AB municipal seats',
    organization: 'OCHA / HDX',
    source_version: '2025-10-30-v01',
    reference_year: 2019,
    is_official: false,
    license: 'CC BY-IGO',
    attribution: 'HDX COD-AB Guatemala',
  })
  report.sources.inserted += 1

  const supabase = getSupabaseAdmin()

  for (const record of adminRecords) {
    const row = {
      source_id: ineSourceId,
      admin_level: record.adminLevel,
      admin_code: record.adminCode,
      department_code: record.departmentCode ?? null,
      municipality_code: record.municipalityCode ?? null,
      admin_name: record.adminName,
      statistic_type: record.statisticType,
      reference_year: record.referenceYear,
      population_total: record.populationTotal,
      population_urban: record.populationUrban ?? null,
      population_rural: record.populationRural ?? null,
      is_census: record.isCensus,
      is_projection: record.isProjection,
      projection_method: record.projectionMethod ?? null,
      temporal_alignment: record.temporalAlignment,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('population_admin_statistics')
      .upsert(row, {
        onConflict: 'source_id,admin_level,admin_code,statistic_type,reference_year',
      })
    if (error) throw new Error(error.message)
    report.adminStatistics.inserted += 1
  }

  for (const settlement of settlements) {
    const { error } = await supabase.from('population_settlements').upsert(
      {
        source_id: hdxSourceId,
        source_settlement_id: settlement.sourceSettlementId,
        name: settlement.name,
        normalized_name: settlement.normalizedName,
        settlement_type: settlement.settlementType,
        department_code: settlement.departmentCode ?? null,
        municipality_code: settlement.municipalityCode ?? null,
        population_reference: settlement.populationReference ?? null,
        population_reference_year: settlement.populationReferenceYear ?? null,
        geom: { type: 'Point', coordinates: [settlement.lon, settlement.lat] },
        location_accuracy: settlement.locationAccuracy,
        metadata: { source: settlement.source },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'source_id,source_settlement_id' },
    )
    if (error) throw new Error(error.message)
    report.settlements.inserted += 1
  }

  return report
}

export async function countPopulationAdminInSupabase(): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('population_admin_statistics')
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function countPopulationSettlementsInSupabase(): Promise<number> {
  const supabase = getSupabaseAdmin()
  const { count, error } = await supabase
    .from('population_settlements')
    .select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}
