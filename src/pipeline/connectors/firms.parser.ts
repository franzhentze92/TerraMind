/**
 * Parser y validación del CSV de NASA FIRMS (VIIRS).
 * Lógica pura — testeable sin red.
 */

export interface FirmsRow {
  latitude: number
  longitude: number
  brightTi4: number | null
  scan: number | null
  track: number | null
  acqDate: string
  acqTime: string
  satellite: string
  instrument: string
  confidence: string
  version: string
  brightTi5: number | null
  frp: number | null
  daynight: string
  productSource?: string
}

export interface FirmsParseStats {
  totalLines: number
  validRows: number
  skippedRows: number
  skipReasons: Record<string, number>
}

export interface FirmsParseResult {
  rows: FirmsRow[]
  stats: FirmsParseStats
}

function parseOptionalFloat(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : null
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

function getColumnIndex(headers: string[], ...names: string[]): number {
  for (const name of names) {
    const idx = headers.indexOf(name)
    if (idx >= 0) return idx
  }
  return -1
}

/** Normaliza acq_date a YYYY-MM-DD (acepta YYYY-MM-DD o YYYYMMDD) */
export function normalizeAcqDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
  }

  return null
}

/** Normaliza acq_time a HHMM; NASA entrega UTC */
export function normalizeAcqTime(raw: string): string | null {
  const digits = raw.trim().replace(/\D/g, '')
  if (!digits) return null
  if (digits.length < 3 || digits.length > 4) return null
  return digits.padStart(4, '0')
}

/** Construye timestamp ISO UTC desde acq_date + acq_time */
export function buildUtcTimestamp(acqDate: string, acqTime: string): string | null {
  const date = normalizeAcqDate(acqDate)
  const time = normalizeAcqTime(acqTime)
  if (!date || !time) return null
  return `${date}T${time.slice(0, 2)}:${time.slice(2, 4)}:00Z`
}

/** ID determinístico para deduplicación */
export function buildFirmsObservationId(row: FirmsRow): string {
  const date = normalizeAcqDate(row.acqDate) ?? row.acqDate
  const time = normalizeAcqTime(row.acqTime) ?? row.acqTime
  const lat = row.latitude.toFixed(4)
  const lng = row.longitude.toFixed(4)
  const product = row.productSource ?? row.satellite
  return `obs:nasa-firms:${product}:${date}${time}:${lat}:${lng}`
}

export function parseFirmsCsv(csv: string): FirmsParseResult {
  const lines = csv.trim().split(/\r?\n/)
  const stats: FirmsParseStats = {
    totalLines: Math.max(0, lines.length - 1),
    validRows: 0,
    skippedRows: 0,
    skipReasons: {},
  }

  if (lines.length < 2) {
    return { rows: [], stats }
  }

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const col = {
    lat: getColumnIndex(headers, 'latitude'),
    lng: getColumnIndex(headers, 'longitude'),
    brightTi4: getColumnIndex(headers, 'bright_ti4', 'brightness'),
    scan: getColumnIndex(headers, 'scan'),
    track: getColumnIndex(headers, 'track'),
    acqDate: getColumnIndex(headers, 'acq_date'),
    acqTime: getColumnIndex(headers, 'acq_time'),
    satellite: getColumnIndex(headers, 'satellite'),
    instrument: getColumnIndex(headers, 'instrument'),
    confidence: getColumnIndex(headers, 'confidence'),
    version: getColumnIndex(headers, 'version'),
    brightTi5: getColumnIndex(headers, 'bright_ti5'),
    frp: getColumnIndex(headers, 'frp'),
    daynight: getColumnIndex(headers, 'daynight'),
  }

  const rows: FirmsRow[] = []

  const skip = (reason: string) => {
    stats.skippedRows++
    stats.skipReasons[reason] = (stats.skipReasons[reason] ?? 0) + 1
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      skip('empty_line')
      continue
    }

    const cols = line.split(',')

    if (col.lat < 0 || col.lng < 0) {
      skip('missing_coordinates_columns')
      continue
    }

    const lat = parseFloat(cols[col.lat])
    const lng = parseFloat(cols[col.lng])

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      skip('invalid_coordinates')
      continue
    }

    if (!isValidCoordinate(lat, lng)) {
      skip('out_of_range_coordinates')
      continue
    }

    const acqDate = col.acqDate >= 0 ? (cols[col.acqDate]?.trim() ?? '') : ''
    const acqTime = col.acqTime >= 0 ? (cols[col.acqTime]?.trim() ?? '') : ''

    if (!normalizeAcqDate(acqDate)) {
      skip('invalid_date')
      continue
    }

    if (!normalizeAcqTime(acqTime)) {
      skip('invalid_time')
      continue
    }

    rows.push({
      latitude: lat,
      longitude: lng,
      brightTi4: col.brightTi4 >= 0 ? parseOptionalFloat(cols[col.brightTi4]) : null,
      scan: col.scan >= 0 ? parseOptionalFloat(cols[col.scan]) : null,
      track: col.track >= 0 ? parseOptionalFloat(cols[col.track]) : null,
      acqDate,
      acqTime,
      satellite: col.satellite >= 0 ? (cols[col.satellite]?.trim() || 'UNKNOWN') : 'UNKNOWN',
      instrument: col.instrument >= 0 ? (cols[col.instrument]?.trim() || 'VIIRS') : 'VIIRS',
      confidence: col.confidence >= 0 ? (cols[col.confidence]?.trim() || 'nominal') : 'nominal',
      version: col.version >= 0 ? (cols[col.version]?.trim() || '') : '',
      brightTi5: col.brightTi5 >= 0 ? parseOptionalFloat(cols[col.brightTi5]) : null,
      frp: col.frp >= 0 ? parseOptionalFloat(cols[col.frp]) : null,
      daynight: col.daynight >= 0 ? (cols[col.daynight]?.trim() || '') : '',
    })
    stats.validRows++
  }

  return { rows, stats }
}

export function mapConfidenceNormalized(confidence: string): 'baja' | 'media' | 'alta' {
  const c = confidence.toLowerCase()
  if (c === 'h' || c === 'high') return 'alta'
  if (c === 'n' || c === 'nominal') return 'media'
  if (c === 'l' || c === 'low') return 'baja'
  const numeric = parseInt(c, 10)
  if (numeric >= 80) return 'alta'
  if (numeric >= 50) return 'media'
  return 'baja'
}

export function mapConfidenceToCalidad(confidence: string): number {
  const c = confidence.toLowerCase()
  if (c === 'h' || c === 'high') return 90
  if (c === 'n' || c === 'nominal') return 75
  if (c === 'l' || c === 'low') return 55
  const numeric = parseInt(c, 10)
  if (numeric >= 80) return 90
  if (numeric >= 50) return 75
  if (numeric >= 30) return 55
  return 60
}
