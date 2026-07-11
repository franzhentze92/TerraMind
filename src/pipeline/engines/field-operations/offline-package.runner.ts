import { randomUUID } from 'node:crypto'

import { FIRE_OFFLINE_PACKAGE_MODEL_VERSION } from '@/modules/field-operations/offline-packages/config/fire-offline-package.config'
import {
  buildOfflinePackage,
  buildOfflinePackageContextSignature,
  nextPackageVersion,
} from '@/modules/field-operations/offline-packages/engine/offline-package.engine'
import type { OfflinePackageManifest } from '@/modules/field-operations/offline-packages/offline-package.types'
import { ALL_OFFLINE_PACKAGE_PERMISSIONS } from '@/modules/field-operations/offline-packages/offline-package-permissions'
import { getActiveAssignmentForMission } from '@/pipeline/stores/mission-assignments.store'
import {
  completeOfflinePackageGeneration,
  createOfflinePackageQueued,
  failOfflinePackageGeneration,
  getActiveOfflinePackageBySignature,
  getOfflinePackageById,
  listPackageVersionsForMission,
  markOfflinePackageGenerating,
  persistOfflinePackageFiles,
  recordOfflinePackageEvent,
  recordOfflinePackageGenerationRun,
  supersedeOfflinePackage,
} from '@/pipeline/stores/offline-mission-packages.store'
import {
  completeOfflinePackageJob,
  enqueueOfflinePackageJob,
} from '@/pipeline/stores/offline-package-jobs.store'
import { getIncidentById } from '@/pipeline/stores/incidents.store'
import {
  getMissionById,
  listMissionEvidenceRequirements,
  listMissionTasks,
} from '@/pipeline/stores/missions.store'
import { listVerificationNeedsForPlan } from '@/pipeline/stores/verification-plans.store'

function asBuildRecord<T extends object>(value: T): Record<string, unknown> {
  return value as unknown as Record<string, unknown>
}

const TERMINAL_MISSION_STATUSES = ['cancelled', 'completed', 'failed']

async function loadMissionBuildContext(missionId: string) {
  const mission = await getMissionById(missionId)
  if (!mission) return null
  const tasks = await listMissionTasks(missionId)
  const evidence = await listMissionEvidenceRequirements(missionId)
  const assignment = await getActiveAssignmentForMission(missionId)
  const incident = await getIncidentById(mission.incident_id)
  const planNeeds = await listVerificationNeedsForPlan(mission.verification_plan_id)
  return { mission, tasks, evidence, assignment, incident, planNeeds }
}

export async function requestOfflinePackageGeneration(input: {
  missionId: string
  actorId?: string | null
  idempotencyKey?: string | null
  allowHistorical?: boolean
}): Promise<{ package_id: string | null; job_id: string | null; decision: string; reasons: string[] }> {
  const ctx = await loadMissionBuildContext(input.missionId)
  if (!ctx) return { package_id: null, job_id: null, decision: 'not_found', reasons: ['mission_not_found'] }

  const evaluatedAt = new Date().toISOString()
  const preview = buildOfflinePackage({
    package_id: 'preview',
    package_version: 1,
    mission: asBuildRecord(ctx.mission),
    tasks: ctx.tasks.map(asBuildRecord),
    evidence_requirements: ctx.evidence.map(asBuildRecord),
    assignment: ctx.assignment ? asBuildRecord(ctx.assignment) : null,
    plan_needs: ctx.planNeeds.map(asBuildRecord),
    incident: ctx.incident ? asBuildRecord(ctx.incident) : null,
    permissions: ALL_OFFLINE_PACKAGE_PERMISSIONS,
    actor_id: input.actorId ?? null,
    evaluated_at: evaluatedAt,
    allow_historical: input.allowHistorical,
  })

  await recordOfflinePackageGenerationRun({
    missionId: input.missionId,
    contextSignature: preview.context_signature,
    idempotencyKey: input.idempotencyKey,
    decision: preview.decision,
    warnings: preview.warnings,
    redactionSummary: asBuildRecord(preview.redaction),
    evaluatedAt,
  })

  if (preview.decision !== 'generate_package') {
    return { package_id: null, job_id: null, decision: preview.decision, reasons: preview.reasons }
  }

  const existing = await getActiveOfflinePackageBySignature({
    missionId: input.missionId,
    contextSignature: preview.context_signature,
  })
  if (existing) {
    return {
      package_id: existing.id,
      job_id: null,
      decision: 'duplicate_exists',
      reasons: ['active_package_same_signature'],
    }
  }

  const versions = await listPackageVersionsForMission(input.missionId)
  const packageVersion = nextPackageVersion(versions)
  const packageId = randomUUID()

  const previousReady = versions.length
    ? await (
        await import('@/pipeline/stores/offline-mission-packages.store')
      ).listOfflinePackagesForMission(input.missionId)
    : []
  const supersedeTarget = previousReady.find((p) => p.status === 'ready' || p.status === 'downloaded')

  await createOfflinePackageQueued({
    id: packageId,
    missionId: input.missionId,
    assignmentId: ctx.assignment?.id ?? null,
    packageVersion,
    contextSignature: preview.context_signature,
    validFrom: preview.valid_from,
    validUntil: preview.valid_until,
    downloadExpiresAt: preview.download_expires_at,
    supersedesPackageId: supersedeTarget?.id ?? null,
  })

  await recordOfflinePackageEvent({
    packageId,
    missionId: input.missionId,
    assignmentId: ctx.assignment?.id ?? null,
    eventType: 'generation_requested',
    actorType: input.actorId ? 'user' : 'system',
    actorId: input.actorId ?? null,
    payload: { context_signature: preview.context_signature, package_version: packageVersion },
  })

  const job = await enqueueOfflinePackageJob({
    missionId: input.missionId,
    assignmentId: ctx.assignment?.id ?? null,
    contextSignature: preview.context_signature,
    idempotencyKey: input.idempotencyKey,
    requestedBy: input.actorId ?? null,
  })

  return {
    package_id: packageId,
    job_id: job.job_id,
    decision: 'generate_package',
    reasons: preview.reasons,
  }
}

export async function runOfflinePackageGeneration(input: {
  missionId: string
  packageId: string
  actorId?: string | null
}): Promise<{ success: boolean; manifest?: OfflinePackageManifest; error?: string }> {
  const ctx = await loadMissionBuildContext(input.missionId)
  if (!ctx) return { success: false, error: 'mission_not_found' }

  if (TERMINAL_MISSION_STATUSES.includes(ctx.mission.status)) {
    await failOfflinePackageGeneration({
      packageId: input.packageId,
      reason: `mission_status_${ctx.mission.status}`,
    })
    await recordOfflinePackageEvent({
      packageId: input.packageId,
      missionId: input.missionId,
      eventType: 'generation_aborted',
      payload: { reason: ctx.mission.status },
    })
    return { success: false, error: 'mission_terminal_status' }
  }

  const pkg = await getOfflinePackageById(input.packageId)
  if (!pkg) return { success: false, error: 'package_not_found' }
  if (pkg.status === 'ready') {
    return { success: true, manifest: pkg.manifest as OfflinePackageManifest }
  }

  await markOfflinePackageGenerating(input.packageId)
  await recordOfflinePackageEvent({
    packageId: input.packageId,
    missionId: input.missionId,
    eventType: 'generation_started',
    actorId: input.actorId ?? null,
  })

  const evaluatedAt = new Date().toISOString()
  try {
    const built = buildOfflinePackage({
      package_id: input.packageId,
      package_version: pkg.package_version,
      supersedes_package_id: pkg.supersedes_package_id,
      mission: asBuildRecord(ctx.mission),
      tasks: ctx.tasks.map(asBuildRecord),
      evidence_requirements: ctx.evidence.map(asBuildRecord),
      assignment: ctx.assignment ? asBuildRecord(ctx.assignment) : null,
      plan_needs: ctx.planNeeds.map(asBuildRecord),
      incident: ctx.incident ? asBuildRecord(ctx.incident) : null,
      permissions: ALL_OFFLINE_PACKAGE_PERMISSIONS,
      actor_id: input.actorId ?? null,
      evaluated_at: evaluatedAt,
      signingKey: process.env.OFFLINE_PACKAGE_SIGNING_KEY,
    })

    if (built.decision !== 'generate_package') {
      await failOfflinePackageGeneration({
        packageId: input.packageId,
        reason: built.reasons.join(','),
      })
      return { success: false, error: built.reasons.join(',') }
    }

    const manifestFile = built.payloads.find((p) => p.path === 'manifest.json')
    if (!manifestFile) throw new Error('manifest_missing')
    const manifest = JSON.parse(manifestFile.content) as OfflinePackageManifest
    const payloadFiles = built.payloads.filter((p) => p.path !== 'manifest.json')
    const sizeBytes = built.payloads.reduce(
      (sum, p) => sum + Buffer.byteLength(p.content, 'utf8'),
      0,
    )

    await persistOfflinePackageFiles({
      packageId: input.packageId,
      files: payloadFiles.map((p) => ({
        path: p.path,
        mime_type: p.mime_type,
        content: p.content,
        sha256: manifest.files.find((f) => f.path === p.path)?.sha256 ?? '',
      })),
    })

    await completeOfflinePackageGeneration({
      packageId: input.packageId,
      manifest,
      sizeBytes,
      generatedAt: evaluatedAt,
      generatedBy: input.actorId ?? null,
    })

    if (pkg.supersedes_package_id) {
      await supersedeOfflinePackage({ packageId: pkg.supersedes_package_id })
      await recordOfflinePackageEvent({
        packageId: pkg.supersedes_package_id,
        missionId: input.missionId,
        eventType: 'superseded',
        payload: { replaced_by: input.packageId },
      })
    }

    await recordOfflinePackageEvent({
      packageId: input.packageId,
      missionId: input.missionId,
      eventType: 'package_generated',
      payload: {
        manifest_checksum: manifest.manifest_sha256,
        signature: manifest.signature,
        model_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
      },
    })

    return { success: true, manifest }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'generation_failed'
    await failOfflinePackageGeneration({ packageId: input.packageId, reason: message })
    await recordOfflinePackageEvent({
      packageId: input.packageId,
      missionId: input.missionId,
      eventType: 'generation_failed',
      payload: { error: message },
    })
    return { success: false, error: message }
  }
}

export async function runOfflinePackageJob(job: {
  id: string
  mission_id: string
}): Promise<void> {
  const packages = await import('@/pipeline/stores/offline-mission-packages.store').then((m) =>
    m.listOfflinePackagesForMission(job.mission_id),
  )
  const target =
    packages.find((p) => p.status === 'queued' || p.status === 'generating') ?? packages[0]
  if (!target) throw new Error('package_not_found_for_job')

  const result = await runOfflinePackageGeneration({
    missionId: job.mission_id,
    packageId: target.id,
  })
  if (!result.success) throw new Error(result.error ?? 'generation_failed')
  await completeOfflinePackageJob(job.id)
}

export async function previewOfflinePackageContextSignature(missionId: string): Promise<string | null> {
  const ctx = await loadMissionBuildContext(missionId)
  if (!ctx) return null
  return buildOfflinePackageContextSignature({
    mission: asBuildRecord(ctx.mission),
    tasks: ctx.tasks.map(asBuildRecord),
    evidence_requirements: ctx.evidence.map(asBuildRecord),
    assignment: ctx.assignment ? asBuildRecord(ctx.assignment) : null,
    plan_needs: ctx.planNeeds.map(asBuildRecord),
    incident: ctx.incident ? asBuildRecord(ctx.incident) : null,
    permissions: ALL_OFFLINE_PACKAGE_PERMISSIONS,
    actor_id: null,
    evaluated_at: new Date().toISOString(),
  })
}
