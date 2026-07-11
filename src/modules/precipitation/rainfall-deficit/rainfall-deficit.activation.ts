/**
 * Rainfall deficit — activation readiness resolution.
 *
 * Gathers the gating signals that decide whether the `rainfall_deficit` feature
 * flag is safe to enable: climatology completeness, per-cell history coverage,
 * ADM2 municipal coverage, and (optionally) source reachability. Pure/synchronous
 * except for the optional source probe.
 */
import { CANONICAL_WINDOW_KEY, RAINFALL_DEFICIT_WINDOWS } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'
import {
  CHIRPS_V3_BASELINE_END,
  CHIRPS_V3_BASELINE_START,
  CHIRPS_V3_MIN_HISTORY_YEARS,
} from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import {
  isClimatologyAvailable,
  loadClimatologyDataset,
  windowSamplesForCell,
} from '@/modules/precipitation/chirps-v3/chirps-climatology.query'
import {
  assignCellsToMunicipalities,
  loadMunicipalities,
  type CellRef,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'

export interface ReadinessCheck {
  id: string
  label: string
  passed: boolean
  detail: string
}

export interface ActivationReadiness {
  ready: boolean
  checks: ReadinessCheck[]
  summary: {
    climatologyAvailable: boolean
    baselineYears: number
    expectedBaselineYears: number
    cellCoveragePercent: number
    municipalitiesTotal: number
    municipalitiesAssigned: number
    lowCoverageMunicipalities: number
  }
}

/** Expected number of Guatemala municipalities from HDX COD-AB ADM2. */
export const EXPECTED_MUNICIPALITIES = 340

/** Fraction of GT cells that must have sufficient history for canonical window. */
export const MIN_CELL_COVERAGE = 0.9

function check(id: string, label: string, passed: boolean, detail: string): ReadinessCheck {
  return { id, label, passed, detail }
}

export function resolveActivationReadiness(): ActivationReadiness {
  const checks: ReadinessCheck[] = []
  const climatologyAvailable = isClimatologyAvailable()

  const summary: ActivationReadiness['summary'] = {
    climatologyAvailable,
    baselineYears: 0,
    expectedBaselineYears: CHIRPS_V3_BASELINE_END - CHIRPS_V3_BASELINE_START + 1,
    cellCoveragePercent: 0,
    municipalitiesTotal: 0,
    municipalitiesAssigned: 0,
    lowCoverageMunicipalities: 0,
  }

  checks.push(
    check(
      'climatology_present',
      'Climatología histórica consolidada',
      climatologyAvailable,
      climatologyAvailable ? 'climatology.bin + meta + grid presentes' : 'Falta climatología consolidada',
    ),
  )

  const ds = climatologyAvailable ? loadClimatologyDataset() : null

  if (ds) {
    summary.baselineYears = ds.years.length
    checks.push(
      check(
        'baseline_years',
        'Años de línea base',
        ds.years.length >= summary.expectedBaselineYears,
        `${ds.years.length}/${summary.expectedBaselineYears} años (${ds.years[0]}–${ds.years.at(-1)})`,
      ),
    )

    // Cell coverage for canonical window at a representative in-season slot.
    const win = RAINFALL_DEFICIT_WINDOWS[CANONICAL_WINDOW_KEY]
    const midSlot = 42 // ~mid-July, core rainy season
    let sufficient = 0
    for (let i = 0; i < ds.grid.cellCount; i++) {
      const { samples } = windowSamplesForCell(ds, i, midSlot, win.pentads)
      if (samples.length >= CHIRPS_V3_MIN_HISTORY_YEARS) sufficient++
    }
    summary.cellCoveragePercent = ds.grid.cellCount > 0 ? sufficient / ds.grid.cellCount : 0
    checks.push(
      check(
        'cell_coverage',
        'Cobertura de celdas con historia suficiente',
        summary.cellCoveragePercent >= MIN_CELL_COVERAGE,
        `${(summary.cellCoveragePercent * 100).toFixed(1)}% de celdas con ≥${CHIRPS_V3_MIN_HISTORY_YEARS} años (mín ${(MIN_CELL_COVERAGE * 100).toFixed(0)}%)`,
      ),
    )

    // Municipal coverage.
    const municipalities = loadMunicipalities()
    summary.municipalitiesTotal = municipalities.length
    const cells: CellRef[] = ds.grid.cells.map((c, i) => ({ index: i, lat: c.lat, lon: c.lon }))
    const assignment = assignCellsToMunicipalities(cells, municipalities)
    let assigned = 0
    for (const [, list] of assignment.byMunicipality) if (list.length > 0) assigned++
    summary.municipalitiesAssigned = assigned
    summary.lowCoverageMunicipalities = assignment.lowCoveragePcodes.length
    checks.push(
      check(
        'municipal_coverage',
        'Cobertura municipal (ADM2)',
        assigned === municipalities.length && municipalities.length >= EXPECTED_MUNICIPALITIES,
        `${assigned}/${municipalities.length} municipios con celda asignada (${assignment.lowCoveragePcodes.length} vía celda más cercana)`,
      ),
    )
  } else {
    // Still verify ADM2 exists structurally even without climatology.
    const municipalities = loadMunicipalities()
    summary.municipalitiesTotal = municipalities.length
    checks.push(
      check(
        'municipal_layer',
        'Capa municipal ADM2 disponible',
        municipalities.length >= EXPECTED_MUNICIPALITIES,
        `${municipalities.length} municipios cargados`,
      ),
    )
  }

  const ready = checks.every((c) => c.passed)
  return { ready, checks, summary }
}
