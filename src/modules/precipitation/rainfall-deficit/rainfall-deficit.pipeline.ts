/**
 * Rainfall deficit — detection pipeline (observations → clusters → events).
 */
import {
  CHIRPS_V3_BASELINE_END,
  CHIRPS_V3_BASELINE_START,
  CHIRPS_V3_GRID_RESOLUTION_DEG,
  CHIRPS_V3_PROCESSING_VERSION,
  CHIRPS_V3_SOURCE_VERSION,
} from '@/modules/precipitation/chirps-v3/chirps-v3.config'
import type { ChirpsPentadRef } from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import {
  comparableBaselinePentads,
  pentadsForWindow,
} from '@/modules/precipitation/chirps-v3/chirps-pentad.calendar'
import type { RainfallDeficitObservation } from '@/modules/precipitation/chirps-v3/chirps-v3.observations'
import { computeWindowMetrics } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.climatology'
import { clusterCandidateCells } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.cluster'
import {
  CANONICAL_WINDOW_KEY,
  RAINFALL_DEFICIT_WINDOWS,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'
import {
  classifyIntensity,
  evaluateCandidateDecision,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.detection'
import { resolveLifecycle } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.lifecycle'
import type {
  RainfallDeficitEnvironmentalEvent,
  RainfallWindowMetrics,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.types'
import type { ChirpsGridCell } from '@/modules/precipitation/chirps-v3/chirps-grid.types'

export interface PentadGridSeries {
  /** pentadKey → cellKey → mm */
  byPentad: Map<string, Map<string, number>>
  refs: ChirpsPentadRef[]
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

function pentadKey(ref: ChirpsPentadRef): string {
  return `${ref.year}-${ref.month}-${ref.pentad}`
}

export function buildPentadSeriesFromObservations(
  observations: RainfallDeficitObservation[],
): PentadGridSeries {
  const byPentad = new Map<string, Map<string, number>>()
  const refSet = new Map<string, ChirpsPentadRef>()

  for (const obs of observations) {
    const a = obs.attributes
    const pk = `${a.pentadYear}-${a.pentadMonth}-${a.pentadIndex}`
    refSet.set(pk, {
      year: a.pentadYear,
      month: a.pentadMonth,
      pentad: a.pentadIndex,
      periodStart: a.periodStart,
      periodEnd: a.periodEnd,
    })
    const match = obs.sourceObservationId?.match(/_(\d+)_(\d+)$/)
    const row = match ? Number(match[1]) : 0
    const col = match ? Number(match[2]) : 0
    const ck = cellKey(row, col)
    if (!byPentad.has(pk)) byPentad.set(pk, new Map())
    byPentad.get(pk)!.set(ck, a.precipitationMm)
  }

  const refs = [...refSet.values()].sort((a, b) =>
    `${a.year}${a.month}${a.pentad}`.localeCompare(`${b.year}${b.month}${b.pentad}`),
  )
  return { byPentad, refs }
}

function sumWindowForCell(
  series: PentadGridSeries,
  windowRefs: ChirpsPentadRef[],
  ck: string,
): number {
  let sum = 0
  for (const ref of windowRefs) {
    sum += series.byPentad.get(pentadKey(ref))?.get(ck) ?? 0
  }
  return sum
}

function historicalSamplesForCell(
  series: PentadGridSeries,
  windowRefs: ChirpsPentadRef[],
  ck: string,
): number[] {
  const baselineRefs = comparableBaselinePentads(
    windowRefs,
    CHIRPS_V3_BASELINE_START,
    CHIRPS_V3_BASELINE_END,
  )
  const byYear = new Map<number, number>()
  for (const ref of baselineRefs) {
    const val = series.byPentad.get(pentadKey(ref))?.get(ck)
    if (val === undefined) continue
    byYear.set(ref.year, (byYear.get(ref.year) ?? 0) + val)
  }
  return [...byYear.values()]
}

export interface CellCandidate {
  cell: ChirpsGridCell
  metrics30: RainfallWindowMetrics
  decisionId: string
  consecutivePentads: number
}

export function findCellCandidates(
  series: PentadGridSeries,
  endDate: Date,
  cellConsecutive: Record<string, number>,
): { candidates: CellCandidate[]; nextConsecutive: Record<string, number> } {
  const windowRefs30 = pentadsForWindow(endDate, RAINFALL_DEFICIT_WINDOWS.days30.days)
  const windowRefs15 = pentadsForWindow(endDate, RAINFALL_DEFICIT_WINDOWS.days15.days)
  const windowRefs60 = pentadsForWindow(endDate, RAINFALL_DEFICIT_WINDOWS.days60.days)

  const allCells = new Set<string>()
  for (const m of series.byPentad.values()) {
    for (const ck of m.keys()) allCells.add(ck)
  }

  const candidates: CellCandidate[] = []
  const nextConsecutive: Record<string, number> = { ...cellConsecutive }

  for (const ck of allCells) {
    const [row, col] = ck.split(',').map(Number)
    const observed30 = sumWindowForCell(series, windowRefs30, ck)
    const hist30 = historicalSamplesForCell(series, windowRefs30, ck)
    const metrics30 = computeWindowMetrics(
      observed30,
      hist30,
      RAINFALL_DEFICIT_WINDOWS.days30.days,
      RAINFALL_DEFICIT_WINDOWS.days30.pentads,
    )
    const decision = evaluateCandidateDecision(ck, metrics30, hist30, cellConsecutive[ck] ?? 0)
    if (decision.isCandidate) {
      const prev = cellConsecutive[ck] ?? 0
      nextConsecutive[ck] = prev + 1
      candidates.push({
        cell: {
          row: row!,
          col: col!,
          lat: 0,
          lon: 0,
          precipitationMm: observed30,
          isNoData: false,
        },
        metrics30,
        decisionId: decision.id,
        consecutivePentads: nextConsecutive[ck]!,
      })
    } else {
      nextConsecutive[ck] = 0
    }

    void windowRefs15
    void windowRefs60
  }

  return { candidates, nextConsecutive }
}

function aggregateWindowMetrics(cells: CellCandidate[]): RainfallWindowMetrics {
  const observed = cells.reduce((s, c) => s + c.metrics30.observedRainfallMm, 0) / cells.length
  const expected =
    cells.reduce((s, c) => s + (c.metrics30.expectedRainfallMm ?? 0), 0) / cells.length
  const histSamples = cells.flatMap((c) =>
    c.metrics30.historicalSampleYears ? [c.metrics30.expectedRainfallMm ?? 0] : [],
  )
  return computeWindowMetrics(
    observed,
    histSamples.length ? histSamples : [expected],
    RAINFALL_DEFICIT_WINDOWS.days30.days,
    RAINFALL_DEFICIT_WINDOWS.days30.pentads,
  )
}

export function buildEventsFromCandidates(
  candidates: CellCandidate[],
  existing: RainfallDeficitEnvironmentalEvent[],
  endDate: Date,
  productStatus: 'preliminary' | 'final',
): RainfallDeficitEnvironmentalEvent[] {
  const clusters = clusterCandidateCells(candidates.map((c) => c.cell))
  const now = endDate.toISOString()
  const events: RainfallDeficitEnvironmentalEvent[] = []

  for (const cluster of clusters) {
    const clusterCells = candidates.filter((c) =>
      cluster.cells.some((cc) => cc.row === c.cell.row && cc.col === c.cell.col),
    )
    const metrics30 = aggregateWindowMetrics(clusterCells)
    const maxPentads = Math.max(...clusterCells.map((c) => c.consecutivePentads), 0)
    const intensity = classifyIntensity(metrics30, maxPentads, false)
    const eventId = `rainfall_deficit_${cluster.id}_${CANONICAL_WINDOW_KEY}`
    const prev = existing.find((e) => e.id === eventId)

    const lifecycle = resolveLifecycle({
      previous: prev?.lifecycleState,
      consecutiveActiveUpdates: maxPentads,
      consecutiveRecoveryUpdates: 0,
      consecutiveInactiveUpdates: 0,
      stillMeetsCriteria: true,
    })

    events.push({
      id: eventId,
      eventType: 'rainfall_deficit',
      title: buildEventTitle(intensity, lifecycle),
      status: lifecycle === 'ended' ? 'resolved' : 'active',
      epistemicStatus: productStatus === 'preliminary' ? 'inferred' : 'observed',
      classification: 'operational',
      geometry: cluster.geometry,
      firstObservedAt: prev?.firstObservedAt ?? now,
      lastObservedAt: now,
      observationCount: clusterCells.length,
      sourceIds: [productStatus === 'preliminary' ? 'chirps_v3_preliminary_pentad' : 'chirps_v3_final_pentad'],
      sourceNames: ['CHIRPS v3'],
      attributes: {
        canonicalWindowDays: RAINFALL_DEFICIT_WINDOWS.days30.days,
        windows: { days30: metrics30 },
        consecutiveDeficitPentads: maxPentads,
        persistenceDays: maxPentads * 5,
        affectedAreaKm2: cluster.areaKm2,
        affectedCellCount: cluster.cellCount,
        currentProductStatus: productStatus,
        sourceVersion: CHIRPS_V3_SOURCE_VERSION,
        timestep: 'pentad',
        processingVersion: CHIRPS_V3_PROCESSING_VERSION,
        baselineStartYear: CHIRPS_V3_BASELINE_START,
        baselineEndYear: CHIRPS_V3_BASELINE_END,
        qualityFlags: productStatus === 'preliminary' ? ['producto_preliminar'] : [],
        gridResolutionDegrees: CHIRPS_V3_GRID_RESOLUTION_DEG,
        intensityClass: intensity,
        lastDecisionId: clusterCells[0]?.decisionId,
      },
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      summary:
        'La precipitación acumulada reciente está por debajo de la distribución histórica esperada para esta zona y época del año.',
      lifecycleState: lifecycle,
      persistence: maxPentads * 5,
      area: cluster.areaKm2,
      severity: intensity === 'severe' ? 4 : intensity === 'elevated' ? 3 : 2,
      trend:
        lifecycle === 'expanding'
          ? { direction: 'rising', label: 'En expansión' }
          : lifecycle === 'declining'
            ? { direction: 'falling', label: 'En recuperación' }
            : { direction: 'stable', label: 'Persistente' },
    })
  }
  return events
}

function buildEventTitle(
  intensity: ReturnType<typeof classifyIntensity>,
  lifecycle: ReturnType<typeof resolveLifecycle>,
): string {
  if (lifecycle === 'declining') return 'Condiciones de precipitación en recuperación'
  if (lifecycle === 'expanding') return 'Déficit de precipitación en expansión'
  if (intensity === 'severe') return 'Déficit de precipitación persistente (severo)'
  return 'Déficit de precipitación persistente'
}

export function runDetectionPipeline(input: {
  observations: RainfallDeficitObservation[]
  existingEvents: RainfallDeficitEnvironmentalEvent[]
  cellConsecutive: Record<string, number>
  endDate?: Date
}): {
  events: RainfallDeficitEnvironmentalEvent[]
  nextConsecutive: Record<string, number>
} {
  const endDate = input.endDate ?? new Date()
  const series = buildPentadSeriesFromObservations(input.observations)
  const { candidates, nextConsecutive } = findCellCandidates(
    series,
    endDate,
    input.cellConsecutive,
  )
  const productStatus =
    input.observations.some((o) => o.attributes.productStatus === 'preliminary')
      ? 'preliminary'
      : 'final'
  const events = buildEventsFromCandidates(
    candidates,
    input.existingEvents,
    endDate,
    productStatus,
  )
  return { events, nextConsecutive }
}
