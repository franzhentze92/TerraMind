import { createHash } from 'node:crypto'
import type { FirmsSourceProduct } from '@/pipeline/connectors/firms.config'

/** Normaliza coordenadas a 6 decimales para estabilidad del dedup_key */
export function normalizeCoord(value: number): string {
  return value.toFixed(6)
}

/**
 * Clave determinística SHA-256 para upsert.
 * Base: source_product | lat | lng | acquired_at_utc
 */
export function buildFireDedupKey(
  sourceProduct: FirmsSourceProduct | string,
  latitude: number,
  longitude: number,
  acquiredAtUtc: string,
): string {
  const payload = [
    sourceProduct,
    normalizeCoord(latitude),
    normalizeCoord(longitude),
    acquiredAtUtc,
  ].join('|')
  return createHash('sha256').update(payload).digest('hex')
}
