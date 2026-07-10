import { config } from 'dotenv'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getBiodiversityService } from '../src/modules/biodiversity/biodiversity.service'
import { partitionAcceptedOccurrences } from '../src/modules/biodiversity/biodiversity-acceptance'
import { buildBiodiversityZoneSummary } from '../src/modules/biodiversity/biodiversity-summary'
import { toPublicOccurrenceDto } from '../src/modules/biodiversity/biodiversity.dto'
import type { BiodiversityOccurrence, BiodiversityProviderId } from '../src/modules/biodiversity/biodiversity.types'
import { markBiodiversityDuplicates } from '../src/modules/biodiversity/biodiversity-deduplication'

config({ path: resolve(process.cwd(), '.env') })

const RADIUS_M = 10_000
const LIMIT = 30

const ZONES = [
  { id: 'A', name: 'Reserva de la Biosfera Maya, Petén', lat: 17.75, lng: -90.25 },
  { id: 'B', name: 'Volcán Acatenango', lat: 14.501, lng: -90.876 },
  { id: 'C', name: 'Manchón Guamuchal / costa de Retalhuleu', lat: 14.05, lng: -91.75 },
] as const

function classifyLicense(license?: string): string {
  if (!license) return 'unknown'
  const l = license.toLowerCase()
  if (l.includes('zero') || l.includes('cc0')) return 'CC0'
  if (l.includes('by-nc')) return 'CC BY-NC'
  if (l.includes('/by/') || l.includes('cc-by')) return 'CC BY'
  if (l.includes('all rights') || l.includes('nd')) return 'restrictive/other'
  return 'other'
}

function countCrossProviderDuplicates(occurrences: BiodiversityOccurrence[]): number {
  const groups = new Map<string, Set<BiodiversityProviderId>>()
  for (const occ of occurrences) {
    if (!occ.duplicateGroupId) continue
    const set = groups.get(occ.duplicateGroupId) ?? new Set()
    set.add(occ.source)
    groups.set(occ.duplicateGroupId, set)
  }
  let pairs = 0
  for (const sources of groups.values()) {
    if (sources.has('gbif') && sources.has('inaturalist')) pairs += 1
  }
  return pairs
}

function sanitizeExample(occ: BiodiversityOccurrence) {
  const dto = toPublicOccurrenceDto(occ) as Record<string, unknown>
  if (occ.privacyLevel !== 'public_exact') {
    delete dto.latitude
    delete dto.longitude
  } else if (typeof dto.latitude === 'number') {
    dto.latitude = Math.round((dto.latitude as number) * 100) / 100
    dto.longitude = Math.round((dto.longitude as number) * 100) / 100
  }
  return dto
}

async function probeProvider(
  zone: (typeof ZONES)[number],
  provider: BiodiversityProviderId,
) {
  const service = getBiodiversityService()
  const started = Date.now()
  const result = await service.searchOccurrences({
    latitude: zone.lat,
    longitude: zone.lng,
    radiusM: RADIUS_M,
    limit: LIMIT,
    providers: [provider],
    qualityFilters: { requireCoordinates: true, excludeGeospatialIssues: true },
  })
  const items = result.byProvider[provider]?.occurrences ?? []
  const { accepted, rejected } = partitionAcceptedOccurrences(items)
  const dates = accepted.map((i) => i.observedAt).filter(Boolean).sort()
  const licenseBreakdown: Record<string, number> = {}
  for (const occ of items) {
    const key = classifyLicense(occ.license)
    licenseBreakdown[key] = (licenseBreakdown[key] ?? 0) + 1
  }

  return {
    zone: zone.id,
    zone_name: zone.name,
    provider,
    radius_m: RADIUS_M,
    radius_km: RADIUS_M / 1000,
    limit: LIMIT,
    temporal_range: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
    records_received: items.length,
    records_accepted: accepted.length,
    records_rejected: rejected.length,
    rejection_reasons: rejected.reduce<Record<string, number>>((acc, r) => {
      acc[r.reason] = (acc[r.reason] ?? 0) + 1
      return acc
    }, {}),
    unique_species: new Set(accepted.map((i) => i.scientificName)).size,
    unresolved_taxa: items.filter((i) => i.scientificName === 'Unknown').length,
    research_grade: items.filter((i) => i.qualityGrade?.toLowerCase() === 'research').length,
    captive_cultivated: items.filter((i) => i.captiveOrCultivated).length,
    obscured_coordinates: items.filter(
      (i) => i.coordinatesObscured || i.privacyLevel !== 'public_exact',
    ).length,
    unknown_licenses: items.filter((i) => i.qualityWarnings.includes('unknown_license')).length,
    license_breakdown: licenseBreakdown,
    possible_duplicates: items.filter((i) => i.possibleDuplicate).length,
    cross_provider_duplicates: 0,
    last_observation: dates[dates.length - 1] ?? null,
    latency_ms: Date.now() - started,
    total_estimate: result.byProvider[provider]?.totalEstimate,
    raw_items: items,
  }
}

async function probeCombined(zone: (typeof ZONES)[number]) {
  const service = getBiodiversityService()
  const started = Date.now()
  const result = await service.searchOccurrences({
    latitude: zone.lat,
    longitude: zone.lng,
    radiusM: RADIUS_M,
    limit: LIMIT,
    qualityFilters: { requireCoordinates: true, excludeGeospatialIssues: true },
  })
  const allRaw = Object.values(result.byProvider).flatMap((r) => r?.occurrences ?? [])
  const marked = markBiodiversityDuplicates(allRaw)
  const cross = countCrossProviderDuplicates(marked)
  const summary = buildBiodiversityZoneSummary({
    zoneName: zone.name,
    radiusKm: RADIUS_M / 1000,
    occurrences: allRaw,
    combinedDeduplicatedCount: result.items.length,
    crossProviderDuplicatePairs: cross,
    generatedAt: new Date().toISOString(),
  })

  return {
    zone: zone.id,
    combined_deduplicated_total: result.items.length,
    cross_provider_duplicate_groups: cross,
    possible_duplicates_marked: result.deduplicatedCount,
    latency_ms: Date.now() - started,
    product_summary: summary,
    combined_items: result.items,
    all_raw: allRaw,
  }
}

function pickExamples(allItems: BiodiversityOccurrence[]) {
  const examples: Array<{ category: string; record: Record<string, unknown> }> = []

  const exact = allItems.find(
    (o) => o.privacyLevel === 'public_exact' && !o.possibleDuplicate && o.license,
  )
  if (exact) examples.push({ category: 'public_exact', record: sanitizeExample(exact) })

  const obscured = allItems.find((o) => o.coordinatesObscured || o.privacyLevel === 'sensitive_generalized')
  if (obscured) examples.push({ category: 'obscured', record: sanitizeExample(obscured) })

  const historical = allItems.find(
    (o) => o.source === 'gbif' && o.recordKind === 'historical_presence',
  ) ?? allItems.find((o) => o.source === 'gbif' && (o.observedAt?.startsWith('20') && parseInt(o.observedAt.slice(0, 4), 10) < 2020))
  if (historical) examples.push({ category: 'gbif_historical', record: sanitizeExample(historical) })

  const duplicate = allItems.find((o) => o.possibleDuplicate && o.duplicateGroupId)
  if (duplicate) examples.push({ category: 'possible_duplicate', record: sanitizeExample(duplicate) })

  const unknownLicense = allItems.find((o) => o.qualityWarnings.includes('unknown_license'))
  if (unknownLicense) examples.push({ category: 'unknown_license', record: sanitizeExample(unknownLicense) })

  return examples
}

function buildDedupShowcase() {
  const simulated = markBiodiversityDuplicates([
    {
      source: 'gbif',
      sourceOccurrenceId: 'gbif-9001',
      scientificName: 'Panthera onca',
      coordinatesObscured: false,
      privacyLevel: 'public_exact',
      sourceUrl: 'https://www.inaturalist.org/observations/9001',
      recordKind: 'citizen_science_observation',
      possibleDuplicate: false,
      observedAt: '2023-06-15',
      latitude: 17.12,
      longitude: -90.45,
      fetchedAt: new Date().toISOString(),
      qualityWarnings: [],
    },
    {
      source: 'inaturalist',
      sourceOccurrenceId: '9001',
      scientificName: 'Panthera onca',
      coordinatesObscured: false,
      privacyLevel: 'public_exact',
      sourceUrl: 'https://www.inaturalist.org/observations/9001',
      recordKind: 'citizen_science_observation',
      possibleDuplicate: false,
      observedAt: '2023-06-15',
      latitude: 17.12,
      longitude: -90.45,
      fetchedAt: new Date().toISOString(),
      qualityWarnings: [],
    },
    {
      source: 'gbif',
      sourceOccurrenceId: 'gbif-8002',
      scientificName: 'Ara macao',
      coordinatesObscured: false,
      privacyLevel: 'public_exact',
      sourceUrl: 'https://www.gbif.org/occurrence/8002',
      recordKind: 'human_observation',
      possibleDuplicate: false,
      observedAt: '2024-01-10',
      latitude: 14.5,
      longitude: -90.87,
      fetchedAt: new Date().toISOString(),
      qualityWarnings: [],
    },
    {
      source: 'inaturalist',
      sourceOccurrenceId: '8003',
      scientificName: 'Ara macao',
      coordinatesObscured: false,
      privacyLevel: 'public_exact',
      sourceUrl: 'https://www.inaturalist.org/observations/8003',
      recordKind: 'citizen_science_observation',
      possibleDuplicate: false,
      observedAt: '2024-01-11',
      latitude: 14.51,
      longitude: -90.88,
      fetchedAt: new Date().toISOString(),
      qualityWarnings: [],
    },
  ])

  const secure = simulated.filter((o) => o.possibleDuplicate && o.deduplicationConfidence === 'exact')
  const candidates = simulated.filter((o) => o.duplicateCandidate)
  const notMerged = simulated.filter((o) => !o.possibleDuplicate && !o.duplicateCandidate)

  return {
    secure_duplicate: secure.map((o) => ({
      source: o.source,
      id: o.sourceOccurrenceId,
      duplicate_group_id: o.duplicateGroupId,
      reason: o.deduplicationReason,
      confidence: 'high',
    })),
    possible_duplicate: candidates.map((o) => ({
      source: o.source,
      id: o.sourceOccurrenceId,
      duplicate_group_id: o.duplicateGroupId,
      reason: o.deduplicationReason,
      confidence: 'low',
      why_not_removed: 'Misma especie y fecha cercana pero sin identificador compartido',
    })),
    similar_not_merged: notMerged.map((o) => ({
      source: o.source,
      id: o.sourceOccurrenceId,
      reason: 'no_shared_key',
      confidence: 'none',
    })),
  }
}

async function main() {
  const providerReports = []
  const combinedReports = []
  const allItems: BiodiversityOccurrence[] = []

  for (const zone of ZONES) {
    for (const provider of ['gbif', 'inaturalist'] as const) {
      try {
        const report = await probeProvider(zone, provider)
        allItems.push(...report.raw_items)
        const { raw_items: _raw, ...clean } = report
        providerReports.push(clean)
      } catch (err) {
        providerReports.push({
          zone: zone.id,
          provider,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
    try {
      const combined = await probeCombined(zone)
      allItems.push(...combined.all_raw)
      const { all_raw: _a, combined_items: _c, ...clean } = combined
      combinedReports.push(clean)
    } catch (err) {
      combinedReports.push({
        zone: zone.id,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const health = await getBiodiversityService().getSystemHealth()
  const licenseTotals: Record<string, number> = {}
  for (const occ of allItems) {
    const k = classifyLicense(occ.license)
    licenseTotals[k] = (licenseTotals[k] ?? 0) + 1
  }

  const payload = {
    generated_at: new Date().toISOString(),
    config: { radius_m: RADIUS_M, limit: LIMIT },
    provider_reports: providerReports,
    combined_reports: combinedReports,
    normalized_examples: pickExamples(allItems),
    deduplication_showcase: buildDedupShowcase(),
    license_totals_from_live_sample: licenseTotals,
    health,
  }

  const outDir = resolve(process.cwd(), 'artifacts', 'review')
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, 'review-output.json')
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ written_to: outPath, ...payload }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
