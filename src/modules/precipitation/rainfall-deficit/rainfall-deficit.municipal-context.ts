/**
 * Rainfall deficit — municipal context for event enrichment.
 *
 * Builds a fast (row,col)→municipality lookup from the climatology grid and the
 * ADM2 layer so detected clusters can be labelled with real municipalities and
 * departments (readable territorial names).
 */
import type { ClimatologyGrid } from '@/modules/precipitation/chirps-v3/chirps-climatology.store'
import {
  assignCellsToMunicipalities,
  loadMunicipalities,
  type CellRef,
  type Municipality,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal'
import { municipalityLabel } from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.municipal-climatology'

export interface MunicipalContext {
  cellKeyToPcode: Map<string, string>
  pcodeToLabel: Map<string, string>
  pcodeToAdm1Pcode: Map<string, string>
  pcodeToName: Map<string, string>
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`
}

export function buildMunicipalContext(grid: ClimatologyGrid, municipalities?: Municipality[]): MunicipalContext {
  const munis = municipalities ?? loadMunicipalities()
  const cells: CellRef[] = grid.cells.map((c, i) => ({ index: i, lat: c.lat, lon: c.lon }))
  const assignment = assignCellsToMunicipalities(cells, munis)

  const cellKeyToPcode = new Map<string, string>()
  for (let i = 0; i < grid.cells.length; i++) {
    const pcode = assignment.cellToMunicipality[i]
    if (!pcode) continue
    const c = grid.cells[i]!
    cellKeyToPcode.set(cellKey(c.row, c.col), pcode)
  }

  const pcodeToLabel = new Map<string, string>()
  const pcodeToAdm1Pcode = new Map<string, string>()
  const pcodeToName = new Map<string, string>()
  for (const m of munis) {
    pcodeToLabel.set(m.pcode, municipalityLabel(m))
    pcodeToAdm1Pcode.set(m.pcode, m.adm1Pcode)
    pcodeToName.set(m.pcode, m.name)
  }

  return { cellKeyToPcode, pcodeToLabel, pcodeToAdm1Pcode, pcodeToName }
}

export function municipalitiesForCells(
  ctx: MunicipalContext,
  cells: Array<{ row: number; col: number }>,
): { pcodes: string[]; names: string[]; municipalityCount: number; departmentCount: number } {
  const pcodes = new Set<string>()
  for (const c of cells) {
    const pcode = ctx.cellKeyToPcode.get(cellKey(c.row, c.col))
    if (pcode) pcodes.add(pcode)
  }
  const departments = new Set<string>()
  const names: string[] = []
  for (const pcode of pcodes) {
    const adm1 = ctx.pcodeToAdm1Pcode.get(pcode)
    if (adm1) departments.add(adm1)
    const label = ctx.pcodeToName.get(pcode)
    if (label) names.push(label)
  }
  names.sort((a, b) => a.localeCompare(b))
  return {
    pcodes: [...pcodes],
    names,
    municipalityCount: pcodes.size,
    departmentCount: departments.size,
  }
}
