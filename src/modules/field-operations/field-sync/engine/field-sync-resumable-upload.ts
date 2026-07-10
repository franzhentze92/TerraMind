import { SYNC_CHUNK_SIZE_BYTES } from '@/modules/field-operations/field-sync/config/fire-field-sync.config'
import type { AssetUploadSession } from '@/modules/field-operations/field-sync/field-sync.types'

export interface ResumableUploadInput {
  session: AssetUploadSession
  bytes: Uint8Array
  put: (url: string, chunk: Uint8Array, offset: number, total: number) => Promise<{ bytes_written: number }>
  renewUrl?: () => Promise<{ upload_url: string; expires_at: string }>
  now_iso: string
}

export interface ResumableUploadResult {
  ok: boolean
  bytes_transferred: number
  status: AssetUploadSession['status']
  reason?: string
  renewed?: boolean
}

export async function uploadAssetResumable(input: ResumableUploadInput): Promise<ResumableUploadResult> {
  const total = input.bytes.byteLength
  let offset = input.session.bytes_transferred
  let url = input.session.upload_url
  let renewed = false

  if (!url) return { ok: false, bytes_transferred: offset, status: 'failed', reason: 'missing_upload_url' }
  if (input.session.upload_url_expires_at && Date.parse(input.session.upload_url_expires_at) <= Date.parse(input.now_iso)) {
    if (!input.renewUrl) {
      return { ok: false, bytes_transferred: offset, status: 'expired', reason: 'upload_url_expired' }
    }
    const fresh = await input.renewUrl()
    url = fresh.upload_url
    renewed = true
  }

  while (offset < total) {
    const end = Math.min(offset + SYNC_CHUNK_SIZE_BYTES, total)
    const chunk = input.bytes.subarray(offset, end)
    try {
      const result = await input.put(url!, chunk, offset, total)
      offset += result.bytes_written
    } catch (err) {
      return {
        ok: false,
        bytes_transferred: offset,
        status: offset >= total ? 'uploaded' : 'failed',
        reason: err instanceof Error ? err.message : 'upload_failed',
        renewed,
      }
    }
  }

  return {
    ok: true,
    bytes_transferred: offset,
    status: 'uploaded',
    renewed,
  }
}

export function mergeUploadProgress(
  session: AssetUploadSession,
  bytesTransferred: number,
  status: AssetUploadSession['status'],
  patch: Partial<AssetUploadSession> = {},
): AssetUploadSession {
  return {
    ...session,
    ...patch,
    bytes_transferred: bytesTransferred,
    status,
    updated_at: new Date().toISOString(),
  }
}
