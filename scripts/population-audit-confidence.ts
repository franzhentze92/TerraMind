#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { buildPopulationContextDto } from '@/modules/fires/utils/population-context.dto'
import { buildPopulationEstimateConfidence } from '@/modules/territory/population/population-estimate-confidence'
import {
  getLatestPopulationContext,
  getPopulationZones,
} from '@/pipeline/stores/population.store'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'

config({ path: resolve(process.cwd(), '.env') })

const HIGHLIGHT_DEPARTMENTS = [
  'Retalhuleu',
  'Sacatepéquez',
  'Escuintla',
  'Jutiapa',
  'Petén',
  'Peten',
]

async function main() {
  const supabase = getSupabaseAdmin()
  const { data: events, error } = await supabase
    .from('fire_events')
    .select('id, geo_departments!fire_events_department_id_fkey (name)')
    .order('id')

  if (error) throw new Error(error.message)

  const report: Array<{
    event_id: string
    department: string | null
    zones: Array<Record<string, unknown>>
    highlighted: boolean
  }> = []

  for (const event of events ?? []) {
    const deptRaw = event.geo_departments as { name?: string } | { name?: string }[] | null
    const deptRow = Array.isArray(deptRaw) ? deptRaw[0] : deptRaw
    const department = deptRow?.name ?? null

    const context = await getLatestPopulationContext(event.id)
    if (!context) continue
    const zones = await getPopulationZones(context.id)
    const dto = buildPopulationContextDto(context, zones)
    if (!dto) continue

    const zoneRows = dto.zones.map((zone) => {
      const confidence = buildPopulationEstimateConfidence({
        primaryEstimate: zone.estimated_population,
        validationEstimate: zone.validation_estimate,
      })
      return {
        radius_m: zone.radius_m,
        constrained: zone.estimated_population,
        unconstrained: zone.validation_estimate ?? null,
        lower: zone.modelled_range?.lower ?? confidence.lowerEstimate,
        upper: zone.modelled_range?.upper ?? confidence.upperEstimate,
        difference_pct: zone.difference_pct ?? confidence.percentageDifference,
        ratio: confidence.ratioBetweenModels,
        confidence: zone.confidence?.level,
        recommended_display: zone.confidence?.recommended_display_mode,
        reasons: zone.confidence?.reasons ?? [],
      }
    })

    const highlighted = HIGHLIGHT_DEPARTMENTS.some((name) =>
      department?.toLowerCase().includes(name.toLowerCase()),
    )

    report.push({
      event_id: event.id,
      department,
      zones: zoneRows,
      highlighted,
    })
  }

  const summary = {
    events_audited: report.length,
    highlighted_events: report.filter((r) => r.highlighted),
    all_events: report,
    confidence_rules: {
      high: 'difference_pct < 5% → single_estimate',
      moderate: '5–20% → estimate_with_uncertainty',
      low: '20–100% → modelled_range',
      very_low: '>= 100% → modelled_range',
    },
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
