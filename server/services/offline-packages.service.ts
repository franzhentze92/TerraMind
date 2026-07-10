import { isDownloadLinkExpired, isPackageExpired, verifyManifestIntegrity } from '@/modules/field-operations/offline-packages/offline-package-canonical'
import {
  ALL_OFFLINE_PACKAGE_PERMISSIONS,
  assertOfflinePackagePermission,
} from '@/modules/field-operations/offline-packages/offline-package-permissions'
import type { OfflinePackageManifest, OfflinePackagePermission } from '@/modules/field-operations/offline-packages/offline-package.types'
import {
  getOfflinePackageById,
  listOfflinePackageEvents,
  listOfflinePackageFiles,
  listOfflinePackagesForMission,
  recordOfflinePackageDownload,
  recordOfflinePackageEvent,
  revokeOfflinePackage,
} from '@/pipeline/stores/offline-mission-packages.store'
import { requestOfflinePackageGeneration } from '@/pipeline/engines/field-operations/offline-package.runner'
import { getMissionById } from '@/pipeline/stores/missions.store'

function permissionsOrDefault(perms?: OfflinePackagePermission[]): OfflinePackagePermission[] {
  return perms?.length ? perms : ALL_OFFLINE_PACKAGE_PERMISSIONS
}

function packageDto(row: Awaited<ReturnType<typeof getOfflinePackageById>>) {
  if (!row) return null
  const manifest = row.manifest as OfflinePackageManifest
  return {
    id: row.id,
    mission_id: row.mission_id,
    assignment_id: row.assignment_id,
    status: row.status,
    package_version: row.package_version,
    offline_package_model_version: row.offline_package_model_version,
    size_bytes: row.size_bytes,
    generated_at: row.generated_at,
    generated_by: row.generated_by,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    download_expires_at: row.download_expires_at,
    revoked_at: row.revoked_at,
    revocation_reason: row.revocation_reason,
    supersedes_package_id: row.supersedes_package_id,
    context_signature: row.context_signature,
    manifest_checksum: row.manifest_checksum,
    signature: row.signature,
    file_count: Array.isArray(manifest?.files) ? manifest.files.length : 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function generateOfflinePackageForMission(
  missionId: string,
  input: {
    actor_id?: string | null
    idempotency_key?: string | null
    permissions?: OfflinePackagePermission[]
    allow_historical?: boolean
  },
) {
  assertOfflinePackagePermission(permissionsOrDefault(input.permissions), 'generate')
  const mission = await getMissionById(missionId)
  if (!mission) return null

  const result = await requestOfflinePackageGeneration({
    missionId,
    actorId: input.actor_id ?? null,
    idempotencyKey: input.idempotency_key ?? null,
    allowHistorical: input.allow_historical,
  })

  const pkg = result.package_id ? await getOfflinePackageById(result.package_id) : null
  return {
    decision: result.decision,
    reasons: result.reasons,
    package: packageDto(pkg),
    job_id: result.job_id,
    generated_at: new Date().toISOString(),
  }
}

export async function listMissionOfflinePackages(
  missionId: string,
  permissions?: OfflinePackagePermission[],
) {
  assertOfflinePackagePermission(permissionsOrDefault(permissions), 'view')
  const rows = await listOfflinePackagesForMission(missionId)
  return {
    items: rows.map((r) => packageDto(r)),
    generated_at: new Date().toISOString(),
  }
}

export async function getOfflinePackageDetail(
  packageId: string,
  permissions?: OfflinePackagePermission[],
) {
  assertOfflinePackagePermission(permissionsOrDefault(permissions), 'view')
  const row = await getOfflinePackageById(packageId)
  if (!row) return null
  const events = await listOfflinePackageEvents(packageId, 20)
  return {
    ...packageDto(row),
    events,
    generated_at: new Date().toISOString(),
  }
}

export async function getOfflinePackageManifest(
  packageId: string,
  permissions?: OfflinePackagePermission[],
) {
  assertOfflinePackagePermission(permissionsOrDefault(permissions), 'view')
  const row = await getOfflinePackageById(packageId)
  if (!row) return null
  return {
    manifest: row.manifest,
    manifest_checksum: row.manifest_checksum,
    signature: row.signature,
    generated_at: new Date().toISOString(),
  }
}

export async function getOfflinePackageStatus(
  packageId: string,
  permissions?: OfflinePackagePermission[],
) {
  assertOfflinePackagePermission(permissionsOrDefault(permissions), 'view')
  const row = await getOfflinePackageById(packageId)
  if (!row) return null
  const now = new Date().toISOString()
  return {
    id: row.id,
    status: row.status,
    package_version: row.package_version,
    valid_until: row.valid_until,
    download_expires_at: row.download_expires_at,
    is_expired: isPackageExpired(row.valid_until, now),
    is_download_link_expired: isDownloadLinkExpired(row.download_expires_at, now),
    revoked_at: row.revoked_at,
    revocation_reason: row.revocation_reason,
    generated_at: new Date().toISOString(),
  }
}

export async function createOfflinePackageDownloadUrl(
  packageId: string,
  input: {
    permissions?: OfflinePackagePermission[]
    user_id?: string | null
    device_pseudonym?: string | null
    app_version?: string | null
    idempotency_key?: string | null
  },
) {
  assertOfflinePackagePermission(permissionsOrDefault(input.permissions), 'download')
  const row = await getOfflinePackageById(packageId)
  if (!row) return null
  if (!['ready', 'downloaded'].includes(row.status)) {
    throw new Error('Paquete no disponible para descarga')
  }
  const now = new Date().toISOString()
  if (isPackageExpired(row.valid_until, now)) {
    throw new Error('Paquete expirado')
  }
  if (row.status === 'revoked') throw new Error('Paquete revocado')

  await recordOfflinePackageEvent({
    packageId,
    missionId: row.mission_id,
    eventType: 'download_requested',
    actorType: input.user_id ? 'user' : 'system',
    actorId: input.user_id ?? null,
  })

  const files = await listOfflinePackageFiles(packageId)
  return {
    package_id: packageId,
    expires_at: row.download_expires_at,
    files: files.map((f) => ({
      path: f.path,
      mime_type: f.mime_type,
      size_bytes: f.size_bytes,
      sha256: f.sha256,
      content: f.content_text,
    })),
    manifest: row.manifest,
    generated_at: now,
  }
}

export async function confirmOfflinePackageDownload(
  packageId: string,
  input: {
    permissions?: OfflinePackagePermission[]
    user_id?: string | null
    team_id?: string | null
    device_pseudonym?: string | null
    app_version?: string | null
    idempotency_key?: string | null
    checksum_verified?: boolean
  },
) {
  assertOfflinePackagePermission(permissionsOrDefault(input.permissions), 'download')
  const row = await getOfflinePackageById(packageId)
  if (!row) return null

  const result = await recordOfflinePackageDownload({
    packageId,
    userId: input.user_id ?? null,
    teamId: input.team_id ?? null,
    devicePseudonym: input.device_pseudonym ?? null,
    appVersion: input.app_version ?? null,
    idempotencyKey: input.idempotency_key ?? null,
    checksumVerified: input.checksum_verified ?? null,
    completed: true,
  })

  await recordOfflinePackageEvent({
    packageId,
    missionId: row.mission_id,
    eventType: 'download_completed',
    actorType: input.user_id ? 'user' : 'system',
    actorId: input.user_id ?? null,
    payload: {
      checksum_verified: input.checksum_verified ?? null,
      idempotent: !result.created,
    },
  })

  return {
    download_id: result.download_id,
    created: result.created,
    package_status: result.created ? 'downloaded' : row.status,
    generated_at: new Date().toISOString(),
  }
}

export async function revokeOfflinePackageById(
  packageId: string,
  input: {
    reason: string
    actor_id?: string | null
    permissions?: OfflinePackagePermission[]
  },
) {
  assertOfflinePackagePermission(permissionsOrDefault(input.permissions), 'revoke')
  if (!input.reason.trim()) throw new Error('Razón de revocación requerida')

  const row = await getOfflinePackageById(packageId)
  if (!row) return null

  const revoked = await revokeOfflinePackage({
    packageId,
    reason: input.reason.trim(),
    actorId: input.actor_id ?? null,
  })

  if (revoked) {
    await recordOfflinePackageEvent({
      packageId,
      missionId: row.mission_id,
      eventType: 'revoked',
      actorType: input.actor_id ? 'user' : 'system',
      actorId: input.actor_id ?? null,
      payload: { reason: input.reason.trim() },
    })
  }

  return {
    package_id: packageId,
    revoked,
    status: revoked ? 'revoked' : row.status,
    generated_at: new Date().toISOString(),
  }
}

export async function validateOfflinePackageIntegrity(packageId: string) {
  const row = await getOfflinePackageById(packageId)
  if (!row) return null
  const manifest = row.manifest as OfflinePackageManifest
  const files = await listOfflinePackageFiles(packageId)
  const payloads = files
    .filter((f) => f.content_text)
    .map((f) => ({ path: String(f.path), content: String(f.content_text) }))
  const result = verifyManifestIntegrity(
    manifest,
    payloads,
    process.env.OFFLINE_PACKAGE_SIGNING_KEY,
  )
  return {
    package_id: packageId,
    valid: result.valid,
    errors: result.errors,
    generated_at: new Date().toISOString(),
  }
}
