import { createHash } from 'node:crypto'

export function sha256Hex(data: string | ArrayBuffer | Uint8Array): string {
  const buf =
    typeof data === 'string'
      ? Buffer.from(data, 'utf8')
      : Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data))
  return createHash('sha256').update(buf).digest('hex')
}

export function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortKeys(v)]),
    )
  }
  return value
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

export function structuredPayloadChecksum(payload: Record<string, unknown>): string {
  return sha256Hex(canonicalJson(payload))
}

export async function blobSha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  return sha256Hex(buffer)
}

export async function bytesSha256(bytes: Uint8Array): Promise<string> {
  return sha256Hex(bytes)
}
