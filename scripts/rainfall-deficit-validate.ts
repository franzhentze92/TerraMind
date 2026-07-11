#!/usr/bin/env npx tsx
/**
 * Rainfall deficit — historical validation & false-positive review.
 *
 * Uses leave-one-out over the baseline: for each municipality and each baseline
 * year, treats that year as "observed" and the remaining years as climatology,
 * then applies the canonical candidate thresholds. Reports flag rates by season,
 * driest cases, and coverage — evidence to review thresholds before activation.
 *
 *   npm run rainfall-deficit:validate
 */
import { CANONICAL_WINDOW_KEY, CANDIDATE_THRESHOLD, RAINFALL_DEFICIT_WINDOWS } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'
import { loadClimatologyDataset } from '@/modules/precipitation/chirps-v3/chirps-climatology.query'
import {
  assignCellsToMunicipalities,
  loadMunicipalities,
  type CellRef,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'
import {
  buildMunicipalTimelines,
  municipalWindowMetric,
  municipalityLabel,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal-climatology'

interface Flag {
  pcode: string
  label: string
  year: number
  slot: number
  observedMm: number
  expectedMm: number
  relativeDeficit: number
  percentile: number
}

function main() {
  const ds = loadClimatologyDataset()
  if (!ds) {
    console.error('[validate] climatología no disponible. Ejecuta build + compile primero.')
    process.exit(2)
  }
  const municipalities = loadMunicipalities()
  const byPcode = new Map(municipalities.map((m) => [m.pcode, m]))
  const cells: CellRef[] = ds.grid.cells.map((c, i) => ({ index: i, lat: c.lat, lon: c.lon }))
  const assignment = assignCellsToMunicipalities(cells, municipalities)
  const timelines = buildMunicipalTimelines(ds, assignment)

  const win = RAINFALL_DEFICIT_WINDOWS[CANONICAL_WINDOW_KEY]
  const nYears = ds.years.length
  const slots = ds.slotsPerYear

  // Rainy season core (May–Oct ≈ slots 25..60) vs dry season.
  const rainySlots: number[] = []
  for (let s = 25; s <= 60; s++) rainySlots.push(s)

  let evaluations = 0
  let candidateFlags = 0
  let insufficient = 0
  const flags: Flag[] = []
  const perYearFlags = new Map<number, number>()

  for (const [pcode, timeline] of timelines) {
    const m = byPcode.get(pcode)
    if (!m) continue
    for (let yIdx = 0; yIdx < nYears; yIdx++) {
      for (const slot of rainySlots) {
        const metric = municipalWindowMetric(timeline, nYears, slots, slot, win.pentads, {
          observedYearIndex: yIdx,
        })
        if (!metric.sufficientHistory || metric.observedMm === undefined || metric.expectedMm === undefined) {
          insufficient++
          continue
        }
        evaluations++
        const rel = metric.relativeDeficitPercent
        const pct = metric.historicalPercentile
        if (
          rel !== undefined &&
          pct !== undefined &&
          rel >= CANDIDATE_THRESHOLD.relativeDeficitPercent &&
          pct <= CANDIDATE_THRESHOLD.historicalPercentileMax
        ) {
          candidateFlags++
          const year = ds.years[yIdx]!
          perYearFlags.set(year, (perYearFlags.get(year) ?? 0) + 1)
          flags.push({
            pcode,
            label: municipalityLabel(m),
            year,
            slot,
            observedMm: Math.round(metric.observedMm),
            expectedMm: Math.round(metric.expectedMm),
            relativeDeficit: rel,
            percentile: pct,
          })
        }
      }
    }
  }

  const rate = evaluations > 0 ? (candidateFlags / evaluations) * 100 : 0
  console.log('=== Rainfall Deficit — Historical Validation (leave-one-out) ===\n')
  console.log(`Municipios: ${municipalities.length} | años base: ${nYears} | ventana canónica: ${win.days}d (${win.pentads} pentadas)`)
  console.log(`Slots de temporada lluviosa evaluados: ${rainySlots.length} (May–Oct)`)
  console.log(`Evaluaciones válidas: ${evaluations} | con historia insuficiente: ${insufficient}`)
  console.log(`Candidatos (déficit≥${CANDIDATE_THRESHOLD.relativeDeficitPercent}% y percentil≤${CANDIDATE_THRESHOLD.historicalPercentileMax}): ${candidateFlags}`)
  console.log(`Tasa de señal por celda-municipio-año-slot: ${rate.toFixed(2)}%`)

  const topYears = [...perYearFlags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log('\nAños con más señales (esperado: años de sequía histórica en Guatemala):')
  for (const [year, n] of topYears) console.log(`  ${year}: ${n}`)

  const driest = [...flags].sort((a, b) => b.relativeDeficit - a.relativeDeficit).slice(0, 12)
  console.log('\nCasos más severos (muestra):')
  for (const f of driest) {
    console.log(
      `  ${f.year} p${f.slot} ${f.label}: obs=${f.observedMm}mm esp=${f.expectedMm}mm déficit=${f.relativeDeficit}% pctl=${f.percentile}`,
    )
  }

  console.log('\nNota: percentil≤20 marca ~20% de años por construcción; el filtro de déficit≥30%')
  console.log('y el piso de lluvia esperada reducen falsos positivos en temporada seca.')
}

main()
