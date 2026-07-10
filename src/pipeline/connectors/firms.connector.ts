import type { Observacion } from '@/ontology/entities/observacion'
import { resolveRegion } from '@/pipeline/territory/guatemala'
import {
  buildFirmsAreaCsvUrl,
  FIRMS_FUENTE_ID,
  FIRMS_INGEST_SOURCES,
  FIRMS_MAPKEY_STATUS_URL,
  FIRMS_VARIABLE_ID,
  type FirmsSourceProduct,
} from './firms.config'
import {
  buildFirmsObservationId,
  buildUtcTimestamp,
  mapConfidenceToCalidad,
  parseFirmsCsv,
  type FirmsParseStats,
  type FirmsRow,
} from './firms.parser'

export function sanitizeFirmsUrl(url: string): string {
  return url.replace(/\/csv\/[^/]+\//, '/csv/[REDACTED]/')
}

function getMapKey(): string | undefined {
  const key = process.env.NASA_FIRMS_MAP_KEY?.trim()
  return key || undefined
}

function requireMapKey(): string {
  const key = getMapKey()
  if (!key) {
    throw new FirmsApiError(
      'UNCONFIGURED',
      'NASA_FIRMS_MAP_KEY no configurada en el servidor.',
    )
  }
  return key
}

export type FirmsApiErrorCode =
  | 'UNCONFIGURED'
  | 'INVALID_KEY'
  | 'TIMEOUT'
  | 'NETWORK'
  | 'HTTP_ERROR'
  | 'EMPTY_RESPONSE'

export class FirmsApiError extends Error {
  readonly code: FirmsApiErrorCode
  readonly status?: number

  constructor(code: FirmsApiErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'FirmsApiError'
    this.code = code
    this.status = status
  }
}

export interface MapKeyStatus {
  valid: boolean
  transactionLimit?: number
  currentTransactions?: number
  transactionInterval?: string
}

export interface FirmsSourceFetchSummary {
  source: FirmsSourceProduct
  rows: number
  status: number
}

export interface FirmsFetchResult {
  rows: FirmsRow[]
  fetchedAt: string
  source: 'api'
  latencyMs: number
  parseStats: FirmsParseStats
  sourceSummaries: FirmsSourceFetchSummary[]
}

function sanitizeApiError(status: number, body: string): FirmsApiError {
  const lower = body.toLowerCase()
  if (
    status === 401 ||
    status === 403 ||
    (lower.includes('invalid') && lower.includes('map')) ||
    lower.includes('map_key')
  ) {
    return new FirmsApiError(
      'INVALID_KEY',
      'Credencial NASA FIRMS inválida. Verifique NASA_FIRMS_MAP_KEY.',
      status,
    )
  }
  return new FirmsApiError(
    'HTTP_ERROR',
    `NASA FIRMS respondió con error HTTP ${status}`,
    status,
  )
}

function mergeParseStats(stats: FirmsParseStats[]): FirmsParseStats {
  return stats.reduce(
    (acc, s) => ({
      totalLines: acc.totalLines + s.totalLines,
      validRows: acc.validRows + s.validRows,
      skippedRows: acc.skippedRows + s.skippedRows,
      skipReasons: Object.fromEntries(
        [...new Set([...Object.keys(acc.skipReasons), ...Object.keys(s.skipReasons)])].map(
          (key) => [
            key,
            (acc.skipReasons[key] ?? 0) + (s.skipReasons[key] ?? 0),
          ],
        ),
      ),
    }),
    { totalLines: 0, validRows: 0, skippedRows: 0, skipReasons: {} },
  )
}

function dedupeRows(rows: FirmsRow[]): FirmsRow[] {
  const seen = new Set<string>()
  const unique: FirmsRow[] = []
  for (const row of rows) {
    const id = buildFirmsObservationId(row)
    if (seen.has(id)) continue
    seen.add(id)
    unique.push(row)
  }
  return unique
}

async function fetchSourceCsv(
  mapKey: string,
  source: FirmsSourceProduct,
): Promise<{ rows: FirmsRow[]; stats: FirmsParseStats; status: number }> {
  const url = buildFirmsAreaCsvUrl(mapKey, source)
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  const body = await response.text()

  if (!response.ok) {
    throw sanitizeApiError(response.status, body)
  }

  const parsed = parseFirmsCsv(body)
  const rows = parsed.rows.map((row) => ({ ...row, productSource: source }))
  return { rows, stats: parsed.stats, status: response.status }
}

/** Descarga CSV de una fuente FIRMS (para ingesta por fuente). */
export async function fetchFirmsSourceCsv(
  source: FirmsSourceProduct,
): Promise<{ rows: FirmsRow[]; stats: FirmsParseStats; status: number }> {
  const mapKey = requireMapKey()
  try {
    return await fetchSourceCsv(mapKey, source)
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new FirmsApiError('TIMEOUT', 'NASA FIRMS no respondió a tiempo.')
    }
    if (err instanceof FirmsApiError) throw err
    throw new FirmsApiError('NETWORK', 'No se pudo conectar con NASA FIRMS.')
  }
}

/** Verifica MAP_KEY sin exponerla en logs */
export async function verifyMapKey(mapKey?: string): Promise<MapKeyStatus> {
  const key = mapKey ?? getMapKey()
  if (!key) {
    return { valid: false }
  }

  const url = `${FIRMS_MAPKEY_STATUS_URL}?MAP_KEY=${encodeURIComponent(key)}`
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })

  if (!response.ok) {
    return { valid: false }
  }

  const data = (await response.json()) as Record<string, unknown>
  return {
    valid: true,
    transactionLimit: Number(data.transaction_limit) || undefined,
    currentTransactions: Number(data.current_transactions) || undefined,
    transactionInterval: String(data.transaction_interval ?? ''),
  }
}

/**
 * Descarga detecciones FIRMS (4 fuentes) para Guatemala.
 * Alineado con el mapa web: múltiples fuentes + ventana de 2 días.
 */
export async function fetchFirmsDetections(): Promise<FirmsFetchResult> {
  const mapKey = requireMapKey()
  const start = Date.now()
  const sourceSummaries: FirmsSourceFetchSummary[] = []
  const allRows: FirmsRow[] = []
  const allStats: FirmsParseStats[] = []

  try {
    for (const source of FIRMS_INGEST_SOURCES) {
      const result = await fetchSourceCsv(mapKey, source)
      sourceSummaries.push({
        source,
        rows: result.rows.length,
        status: result.status,
      })
      allRows.push(...result.rows)
      allStats.push(result.stats)
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new FirmsApiError('TIMEOUT', 'NASA FIRMS no respondió a tiempo.')
    }
    if (err instanceof FirmsApiError) throw err
    throw new FirmsApiError('NETWORK', 'No se pudo conectar con NASA FIRMS.')
  }

  const rows = dedupeRows(allRows)

  return {
    rows,
    fetchedAt: new Date().toISOString(),
    source: 'api',
    latencyMs: Date.now() - start,
    parseStats: mergeParseStats(allStats),
    sourceSummaries,
  }
}

/** Convierte filas FIRMS válidas en Observaciones de TerraMind */
export function firmsRowsToObservations(
  rows: FirmsRow[],
  ingestedAt: string,
): Observacion[] {
  return rows.map((row) => {
    const region = resolveRegion(row.latitude, row.longitude)
    const timestamp = buildUtcTimestamp(row.acqDate, row.acqTime) ?? ingestedAt

    return {
      id: buildFirmsObservationId(row),
      variableId: FIRMS_VARIABLE_ID,
      fuenteId: FIRMS_FUENTE_ID,
      territorioId: region.id,
      timestamp,
      ingestedAt,
      valor: row.frp ?? 0,
      unidad: 'MW',
      ubicacion: {
        type: 'point',
        coordinates: [row.longitude, row.latitude],
        regionName: region.name,
        countryCode: 'GT',
      },
      calidad: mapConfidenceToCalidad(row.confidence),
      flags: row.daynight ? [`daynight:${row.daynight}`] : [],
      referenciaRaw: `firms:${row.productSource ?? row.satellite}:${row.acqDate}${row.acqTime}:${row.latitude},${row.longitude}`,
      metadata: {
        detectionLabel: 'Foco de calor detectado',
        productSource: row.productSource,
        satellite: row.satellite,
        instrument: row.instrument,
        confidence: row.confidence,
        brightTi4: row.brightTi4,
        brightTi5: row.brightTi5,
        frp: row.frp,
        daynight: row.daynight,
        scan: row.scan,
        track: row.track,
        version: row.version,
      },
    }
  })
}
