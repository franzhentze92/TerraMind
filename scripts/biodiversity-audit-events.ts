#!/usr/bin/env tsx
import { config } from 'dotenv'
import { resolve } from 'node:path'

import { buildBiodiversityContextDto } from '@/modules/fires/utils/biodiversity-context.dto'
import {
  getBiodiversityVisualHighlights,
  getBiodiversityZones,
  getLatestBiodiversityContext,
} from '@/pipeline/stores/biodiversity-event.store'
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
    const context = await getLatestBiodiversityContext(event.id)
    if (!context) continue
    const zones = await getBiodiversityZones(context.id)
    const highlights = await getBiodiversityVisualHighlights(context.id)
    const dto = buildBiodiversityContextDto(context, zones, highlights)
    if (!dto) continue

    const largest = dto.zones[dto.zones.length - 1]
    report.push({
      event_id: event.id,
      department: dept,
      highlighted: HIGHLIGHT.some((h) => dept?.includes(h)),
      status: dto.status,
      geometry_source: dto.geometry_source,
      species: largest?.unique_species_documented ?? 0,
      observations: largest?.observations_documented ?? 0,
      recent_30d: largest?.observations_recent_30d ?? 0,
      gbif: largest?.gbif_count ?? 0,
      inaturalist: largest?.inaturalist_count ?? 0,
      taxa: largest?.taxa_distribution ?? {},
      generalized: largest?.generalized_count ?? 0,
      obscured: largest?.obscured_count ?? 0,
      excluded: largest?.spatially_excluded_count ?? 0,
      duplicates: largest?.duplicated_count ?? 0,
      usable_media: largest?.media_usable_count ?? 0,
      zone_relation: dto.monitored_zone_context.relation,
      quality: dto.summary.quality.level,
      truncated: largest?.truncated ?? false,
      visual_highlights: dto.visual_highlights.length,
      warnings: dto.warnings,
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
