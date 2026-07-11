/**
 * CHIRPS v3 — climatology storage (compact single-artifact, no thousands of JSON files).
 *
 * Layout under data/climate/chirps/v3/climatology/:
 *   - pentads/{year}/{pentad}.f32   → processing cache: 84x84 Float32 (NaN = NoData)
 *   - grid.json                     → cell index (row/col/lat/lon) + bbox + resolution
 *   - climatology.bin               → consolidated per-cell per-pentad-slot baseline matrix
 *   - climatology.meta.json         → baseline years, dimensions, checksum, processingVersion
 *   - _checkpoint.json              → resumable ingest checkpoint
 *
 * The pentad cache and consolidated binary are git-ignored (see .gitignore).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const CLIMATOLOGY_ROOT = resolve(process.cwd(), 'data/climate/chirps/v3/climatology')
export const PENTAD_CACHE_DIR = resolve(CLIMATOLOGY_ROOT, 'pentads')
export const GRID_PATH = resolve(CLIMATOLOGY_ROOT, 'grid.json')
export const CLIMATOLOGY_BIN_PATH = resolve(CLIMATOLOGY_ROOT, 'climatology.bin')
export const CLIMATOLOGY_META_PATH = resolve(CLIMATOLOGY_ROOT, 'climatology.meta.json')
export const CHECKPOINT_PATH = resolve(CLIMATOLOGY_ROOT, '_checkpoint.json')

/** CHIRPS uses 6 pentads per month → 72 pentads per year. */
export const PENTADS_PER_YEAR = 72

export interface ClimatologyGrid {
  rows: number
  cols: number
  cellCount: number
  bbox: [number, number, number, number]
  resolutionDeg: number
  /** Flattened row-major cell descriptors. */
  cells: Array<{ row: number; col: number; lat: number; lon: number }>
}

export interface ClimatologyMeta {
  baselineStartYear: number
  baselineEndYear: number
  years: number[]
  pentadsPerYear: number
  cellCount: number
  processingVersion: string
  checksum: string
  builtAt: string
}

export interface IngestCheckpoint {
  processingVersion: string
  completed: string[]
  failed: Array<{ key: string; code: string; message: string }>
  updatedAt: string
}

export function pentadSlot(month: number, pentad: number): number {
  return (month - 1) * 6 + pentad
}

export function slotToMonthPentad(slot: number): { month: number; pentad: number } {
  const month = Math.floor((slot - 1) / 6) + 1
  const pentad = ((slot - 1) % 6) + 1
  return { month, pentad }
}

export function pentadCachePath(year: number, slot: number): string {
  return resolve(PENTAD_CACHE_DIR, String(year), `${slot}.f32`)
}

export function writePentadCache(year: number, slot: number, values: Float32Array): void {
  const path = pentadCachePath(year, slot)
  mkdirSync(resolve(path, '..'), { recursive: true })
  writeFileSync(path, Buffer.from(values.buffer, values.byteOffset, values.byteLength))
}

export function readPentadCache(year: number, slot: number, cellCount: number): Float32Array | null {
  const path = pentadCachePath(year, slot)
  if (!existsSync(path)) return null
  const buf = readFileSync(path)
  if (buf.byteLength < cellCount * 4) return null
  return new Float32Array(buf.buffer, buf.byteOffset, cellCount)
}

export function loadGrid(): ClimatologyGrid | null {
  if (!existsSync(GRID_PATH)) return null
  return JSON.parse(readFileSync(GRID_PATH, 'utf8')) as ClimatologyGrid
}

export function saveGrid(grid: ClimatologyGrid): void {
  mkdirSync(CLIMATOLOGY_ROOT, { recursive: true })
  writeFileSync(GRID_PATH, JSON.stringify(grid))
}

export function loadCheckpoint(processingVersion: string): IngestCheckpoint {
  if (!existsSync(CHECKPOINT_PATH)) {
    return { processingVersion, completed: [], failed: [], updatedAt: new Date().toISOString() }
  }
  const cp = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8')) as IngestCheckpoint
  if (cp.processingVersion !== processingVersion) {
    return { processingVersion, completed: [], failed: [], updatedAt: new Date().toISOString() }
  }
  return cp
}

export function saveCheckpoint(cp: IngestCheckpoint): void {
  mkdirSync(CLIMATOLOGY_ROOT, { recursive: true })
  cp.updatedAt = new Date().toISOString()
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp, null, 2))
}

export function ingestKey(year: number, slot: number): string {
  return `${year}:${slot}`
}

/**
 * Consolidated baseline matrix, row-major: [cellIndex * years + yearIndex] = pentad slot value.
 * Stored/queried per (cell, slot) at build/read time. Kept as a single binary artifact.
 */
export function saveClimatologyMatrix(matrix: Float32Array, meta: Omit<ClimatologyMeta, 'checksum'>): ClimatologyMeta {
  mkdirSync(CLIMATOLOGY_ROOT, { recursive: true })
  const buf = Buffer.from(matrix.buffer, matrix.byteOffset, matrix.byteLength)
  writeFileSync(CLIMATOLOGY_BIN_PATH, buf)
  const checksum = createHash('sha256').update(buf).digest('hex')
  const full: ClimatologyMeta = { ...meta, checksum }
  writeFileSync(CLIMATOLOGY_META_PATH, JSON.stringify(full, null, 2))
  return full
}

export function loadClimatologyMeta(): ClimatologyMeta | null {
  if (!existsSync(CLIMATOLOGY_META_PATH)) return null
  return JSON.parse(readFileSync(CLIMATOLOGY_META_PATH, 'utf8')) as ClimatologyMeta
}
