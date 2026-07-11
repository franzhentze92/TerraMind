import type { OfflinePackageManifest } from '@/modules/field-operations/offline-packages/offline-package.types'
import { authFetch } from '@/core/auth/auth-fetch'

const API = '/api/operations'

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function listMissionOfflinePackages(missionId: string) {
  return fetchJson<{ items: Array<Record<string, unknown>>; generated_at: string }>(
    `${API}/missions/${missionId}/offline-packages`,
  )
}

export async function generateOfflinePackage(
  missionId: string,
  input: { idempotency_key: string; actor_id?: string; allow_historical?: boolean },
) {
  return fetchJson<{
    decision: string
    reasons: string[]
    package: Record<string, unknown> | null
    job_id: string | null
  }>(`${API}/missions/${missionId}/offline-packages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function getOfflinePackage(packageId: string) {
  return fetchJson<Record<string, unknown>>(`${API}/offline-packages/${packageId}`)
}

export async function getOfflinePackageManifestApi(packageId: string) {
  return fetchJson<{ manifest: OfflinePackageManifest }>(`${API}/offline-packages/${packageId}/manifest`)
}

export async function getOfflinePackageStatusApi(packageId: string) {
  return fetchJson<Record<string, unknown>>(`${API}/offline-packages/${packageId}/status`)
}

export async function requestOfflinePackageDownloadUrl(
  packageId: string,
  input?: { device_pseudonym?: string; app_version?: string; idempotency_key?: string },
) {
  return fetchJson<{
    package_id: string
    expires_at: string | null
    files: Array<{ path: string; mime_type: string; size_bytes: number; sha256: string; content: string | null }>
    manifest: OfflinePackageManifest
  }>(`${API}/offline-packages/${packageId}/download-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input ?? {}),
  })
}

export async function confirmOfflinePackageDownloadApi(
  packageId: string,
  input: { idempotency_key: string; checksum_verified?: boolean; device_pseudonym?: string },
) {
  return fetchJson<Record<string, unknown>>(`${API}/offline-packages/${packageId}/confirm-download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function revokeOfflinePackageApi(
  packageId: string,
  input: { reason: string; actor_id?: string },
) {
  return fetchJson<Record<string, unknown>>(`${API}/offline-packages/${packageId}/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export async function validateOfflinePackageApi(packageId: string) {
  return fetchJson<{ valid: boolean; errors: string[] }>(`${API}/offline-packages/${packageId}/validate`)
}
