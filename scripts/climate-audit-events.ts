#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { buildClimateContextDto } from '@/modules/fires/utils/climate-context.dto'
import { getLatestClimateContext } from '@/pipeline/stores/climate.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

const HIGHLIGHT = ['Retalhuleu', 'Sacatepéquez', 'Escuintla', 'Jutiapa', 'Petén', 'Peten']

async function main() {
  const supabase = getSupabaseAdmin()
  const { data: events, error } = await supabase
    .from('fire_events')
    .select('id, geo_departments!fire_events_department_id_fkey (name)')
    .order('id')

  if (error) throw new Error(error.message)

  const report = []
  for (const event of events ?? []) {
    const deptRaw = event.geo_departments as { name?: string } | { name?: string }[] | null
    const dept = (Array.isArray(deptRaw) ? deptRaw[0] : deptRaw)?.name ?? null
    const context = await getLatestClimateContext(event.id)
    if (!context) continue
    const dto = buildClimateContextDto(context)
    if (!dto) continue

    report.push({
      event_id: event.id,
      department: dept,
      highlighted: HIGHLIGHT.some((h) => dept?.includes(h)),
      status: dto.status,
      matched_time: dto.event_conditions.matched_time,
      temperature_c: dto.event_conditions.temperature_c?.mean,
      humidity_pct: dto.event_conditions.relative_humidity_pct?.mean,
      wind_kmh: dto.event_conditions.wind_speed_kmh?.mean,
      wind_direction: dto.event_conditions.wind_direction,
      gust_kmh: dto.event_conditions.wind_gust_kmh?.max,
      precip_24h_mm: dto.antecedent.precipitation_previous_24h_mm,
      precip_7d_mm: dto.antecedent.precipitation_previous_7d_mm,
      precip_30d_mm: dto.antecedent.precipitation_previous_30d_mm,
      dry_days: dto.antecedent.dry_days_consecutive,
      forecast_24h_mm: dto.forecast.precipitation_next_24h_mm,
      forecast_72h_mm: dto.forecast.precipitation_next_72h_mm,
      warnings: dto.warnings,
      point_count: dto.spatial_variability.point_count,
    })
  }

  console.log(
    JSON.stringify(
      {
        events_audited: report.length,
        highlighted: report.filter((r) => r.highlighted),
        all: report,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
