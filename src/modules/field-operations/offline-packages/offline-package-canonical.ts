import { createHash, createHmac } from 'node:crypto'

import type { OfflinePackageManifest, OfflinePackageManifestFile } from '@/modules/field-operations/offline-packages/offline-package.types'

export function sha256Hex(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    )
    return Object.fromEntries(entries.map(([k, v]) => [k, sortKeys(v)]))
  }
  return value
}

export function buildManifestFiles(
  payloads: Array<{ path: string; mime_type: string; content: string }>,
): OfflinePackageManifestFile[] {
  return payloads
    .map((file) => ({
      path: file.path,
      mime_type: file.mime_type,
      size_bytes: Buffer.byteLength(file.content, 'utf8'),
      sha256: sha256Hex(file.content),
    }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

export function signManifestChecksum(
  manifestChecksum: string,
  signingKey?: string | null,
): { signature: string; signature_algorithm: string } {
  if (signingKey?.trim()) {
    return {
      signature: createHmac('sha256', signingKey.trim()).update(manifestChecksum).digest('hex'),
      signature_algorithm: 'hmac-sha256',
    }
  }
  return {
    signature: sha256Hex(`unsigned:${manifestChecksum}`),
    signature_algorithm: 'sha256-integrity-only',
  }
}

export function buildSignedManifest(input: {
  package_id: string
  package_version: number
  mission_id: string
  mission_profile_version: string
  offline_package_model_version: string
  generated_at: string
  generated_by: string | null
  valid_from: string
  valid_until: string
  supersedes_package_id: string | null
  context_signature: string
  files: OfflinePackageManifestFile[]
  map_resource_manifest?: Record<string, unknown>
  signingKey?: string | null
}): OfflinePackageManifest {
  const manifestBody = {
    package_id: input.package_id,
    package_version: input.package_version,
    mission_id: input.mission_id,
    mission_profile_version: input.mission_profile_version,
    offline_package_model_version: input.offline_package_model_version,
    generated_at: input.generated_at,
    generated_by: input.generated_by,
    valid_from: input.valid_from,
    valid_until: input.valid_until,
    supersedes_package_id: input.supersedes_package_id,
    context_signature: input.context_signature,
    files: input.files,
    map_resource_manifest: input.map_resource_manifest ?? { version: '1', tiles: [] },
  }
  const manifest_sha256 = sha256Hex(canonicalJson(manifestBody))
  const signed = signManifestChecksum(manifest_sha256, input.signingKey)
  return {
    ...manifestBody,
    manifest_sha256,
    signature: signed.signature,
    signature_algorithm: signed.signature_algorithm,
  }
}

export function verifyManifestIntegrity(
  manifest: OfflinePackageManifest,
  payloads: Array<{ path: string; content: string }>,
  signingKey?: string | null,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const payloadMap = new Map(payloads.map((p) => [p.path, p.content]))

  for (const file of manifest.files) {
    const content = payloadMap.get(file.path)
    if (content === undefined) {
      errors.push(`missing_file:${file.path}`)
      continue
    }
    const digest = sha256Hex(content)
    if (digest !== file.sha256) errors.push(`checksum_mismatch:${file.path}`)
  }

  const manifestBody = {
    package_id: manifest.package_id,
    package_version: manifest.package_version,
    mission_id: manifest.mission_id,
    mission_profile_version: manifest.mission_profile_version,
    offline_package_model_version: manifest.offline_package_model_version,
    generated_at: manifest.generated_at,
    generated_by: manifest.generated_by,
    valid_from: manifest.valid_from,
    valid_until: manifest.valid_until,
    supersedes_package_id: manifest.supersedes_package_id,
    context_signature: manifest.context_signature,
    files: manifest.files,
    map_resource_manifest: manifest.map_resource_manifest ?? { version: '1', tiles: [] },
  }
  const expectedChecksum = sha256Hex(canonicalJson(manifestBody))
  if (expectedChecksum !== manifest.manifest_sha256) {
    errors.push('manifest_checksum_mismatch')
  }

  const signed = signManifestChecksum(manifest.manifest_sha256, signingKey)
  if (signed.signature !== manifest.signature) errors.push('signature_mismatch')

  return { valid: errors.length === 0, errors }
}

export function isPackageExpired(validUntil: string, nowIso: string): boolean {
  return Date.parse(validUntil) < Date.parse(nowIso)
}

export function isDownloadLinkExpired(downloadExpiresAt: string | null, nowIso: string): boolean {
  if (!downloadExpiresAt) return false
  return Date.parse(downloadExpiresAt) < Date.parse(nowIso)
}
