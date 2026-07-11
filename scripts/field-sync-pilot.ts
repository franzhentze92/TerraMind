#!/usr/bin/env tsx
/**
 * 8B.7G — Controlled Real Field Sync Pilot CLI.
 * Requires --mode and --confirm-project for remote mutations.
 */
import { createHash, randomUUID } from 'node:crypto'
import { config } from 'dotenv'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { maskProjectRef, parseRealSyncPilotPolicyFromEnv } from '../src/core/field-sync/real-sync-pilot-policy.js'
import type { RequestAuthContext } from '../src/core/auth/permissions.js'
import { resetSupabaseClient, getSupabaseAdmin } from '../src/pipeline/stores/supabase.client.js'
import { buildAuthSessionPayload } from '../server/services/provisioning/session.service.js'
import {
  registerBundleSync,
  startEvidenceUploadSession,
  reportUploadProgress,
  linkSubmissionRequirements,
  finalizeSubmissionIntake,
  getSubmissionReconciliation,
  completeBundleRegistration,
} from '../server/services/field-sync.service.js'
import {
  createEvidenceSubmission,
  confirmEvidenceUpload,
  addStructuredObservation,
} from '../server/services/evidence-intake.service.js'
import { listEvidenceAssets } from '../src/pipeline/stores/evidence-intake.store.js'
import { generateOfflinePackageForMission } from '../server/services/offline-packages.service.js'
import { executeMissionWorkflow } from '../server/services/mission-workflow.service.js'
import { listMissionEvidenceRequirements } from '../src/pipeline/stores/missions.store.js'

config({ path: resolve(process.cwd(), '.env') })

type PilotMode = 'preflight' | 'setup' | 'run' | 'verify' | 'cleanup'

const PILOT_TITLE = 'Field Sync Pilot — Internal Verification'
const PILOT_TAG = 'internal_pilot'

interface PilotState {
  organization_id?: string
  auth_user_id?: string
  user_profile_id?: string
  mission_id?: string
  package_id?: string
  submission_id?: string
  bundle_id?: string
  bundle_checksum?: string
}

function parseMode(argv: string[]): PilotMode {
  const modeArg = argv.find((a) => a.startsWith('--mode='))
  if (!modeArg) {
    console.error(`Usage: npx tsx scripts/field-sync-pilot.ts --mode=preflight|setup|run|verify|cleanup --confirm-project=REF`)
    process.exit(1)
  }
  return modeArg.slice('--mode='.length) as PilotMode
}

function parseConfirmProject(argv: string[]): string {
  const arg = argv.find((a) => a.startsWith('--confirm-project='))
  if (!arg) throw new Error('--confirm-project required')
  return arg.slice('--confirm-project='.length).trim()
}

function extractProjectRef(url: string): string {
  const m = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i)
  if (!m) throw new Error('invalid SUPABASE_URL')
  return m[1]
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim()
  if (!v) throw new Error(`${name} required`)
  return v
}

function statePath() {
  return resolve(process.cwd(), 'docs/reports/8B7G-pilot-state.json')
}

function loadState(): PilotState {
  try {
    return JSON.parse(readFileSync(statePath(), 'utf8')) as PilotState
  } catch {
    return {}
  }
}

function saveState(state: PilotState) {
  mkdirSync(resolve(process.cwd(), 'docs/reports'), { recursive: true })
  writeFileSync(statePath(), `${JSON.stringify({ ...state, updated_at: new Date().toISOString() }, null, 2)}\n`)
}

async function resolveAdminAuth(authUserId: string): Promise<RequestAuthContext> {
  const session = await buildAuthSessionPayload(authUserId)
  if (!session.context) throw new Error('admin session unavailable — check membership')
  return session.context
}

async function runPreflight(projectRef: string) {
  const policy = parseRealSyncPilotPolicyFromEnv(process.env)
  console.log(
    JSON.stringify(
      {
        phase: '8B.7G-preflight',
        project_ref_masked: maskProjectRef(projectRef),
        global_real_sync_enabled: false,
        pilot_enabled: policy.enabled,
        allowlist_counts: {
          orgs: policy.allowedOrganizationIds.length,
          users: policy.allowedUserIds.length,
          missions: policy.allowedMissionIds.length,
        },
        required_env: [
          'SUPABASE_URL',
          'SUPABASE_SERVICE_ROLE_KEY',
          'FIELD_REAL_SYNC_PILOT_ENABLED',
          'FIELD_SYNC_PILOT_ORG_IDS',
          'FIELD_SYNC_PILOT_USER_IDS',
          'FIELD_SYNC_PILOT_MISSION_IDS',
          'AUTH_TEST_EMAIL',
          'AUTH_TEST_PASSWORD',
        ],
      },
      null,
      2,
    ),
  )
}

async function runSetup(projectRef: string): Promise<PilotState> {
  resetSupabaseClient()
  const admin = getSupabaseAdmin()

  const { data: org } = await admin.from('organizations').select('id, slug').eq('slug', 'terramind-platform').single()
  if (!org) throw new Error('TerraMind Platform organization not found')

  const email = requireEnv('AUTH_TEST_EMAIL')
  const { data: profile } = await admin.from('user_profiles').select('id, auth_user_id').eq('email', email).single()
  if (!profile) throw new Error('platform admin profile not found — run 8B.7F.4 bootstrap first')

  let missionId = process.env.FIELD_SYNC_PILOT_MISSION_IDS?.split(',')[0]?.trim()
  const { data: existingMission } = missionId
    ? await admin.from('missions').select('id, title').eq('id', missionId).maybeSingle()
    : { data: null }

  if (!existingMission) {
    const { data: ctx } = await admin
      .from('verification_plans')
      .select('id, incident_id')
      .is('linked_mission_id', null)
      .limit(1)
      .maybeSingle()
    if (!ctx) throw new Error('no verification plan available for pilot mission')

    const now = new Date()
    const due = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
    const { data: mission, error } = await admin
      .from('missions')
      .insert({
        mission_type: 'field_verification',
        domain: 'fire',
        title: PILOT_TITLE,
        objective:
          'Misión técnica interna 8B.7G — validación de field sync real. NO representa emergencia ni confirmación ambiental.',
        status: 'approved',
        incident_id: ctx.incident_id,
        verification_plan_id: ctx.id,
        primary_verification_need_id: null,
        recommended_method_code: 'field_visit',
        location_description: 'Pilot site — internal only',
        priority: 1,
        earliest_start_at: now.toISOString(),
        due_at: due.toISOString(),
        expires_at: due.toISOString(),
        organization_id: org.id,
        completion_criteria: { text: 'Complete pilot evidence bundle' },
        inconclusive_criteria: { text: 'N/A' },
        mission_profile_version: '8B.7G-pilot',
        source_snapshot: { internal_pilot: true, label: PILOT_TAG },
        context_signature: `pilot-${randomUUID()}`,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    missionId = String(mission.id)

    await admin.from('mission_tasks').insert({
      mission_id: missionId,
      task_type: 'field_observation',
      sequence: 1,
      title: 'Captura piloto',
      instructions: 'Foto, ubicación, observación estructurada y nota breve.',
      status: 'pending',
      required: true,
      completion_criteria: { text: 'All pilot requirements met' },
    })

    await admin.from('mission_evidence_requirements').insert([
      {
        mission_id: missionId,
        evidence_type: 'georeferenced_photo',
        required: true,
        minimum_count: 1,
        required_metadata: { location: true },
        quality_criteria: {},
        acceptance_criteria: { text: 'Single controlled pilot photo' },
      },
      {
        mission_id: missionId,
        evidence_type: 'structured_observation',
        required: true,
        minimum_count: 1,
        required_metadata: {},
        quality_criteria: {},
        acceptance_criteria: { text: 'Brief structured note' },
      },
    ])
  }

  const assigneeId = `pilot-user-${String(profile.id).slice(0, 8)}`
  await admin.from('operational_assignees').upsert({
    id: assigneeId,
    assignee_type: 'user',
    display_name: 'Pilot Internal Admin',
    organization_id: String(org.id),
    user_profile_id: profile.id,
    is_available: true,
    is_active: true,
    permissions: ['field_sync.execute', 'evidence.submit', 'offline_packages.download'],
  })

  const auth = await resolveAdminAuth(String(profile.auth_user_id))
  await executeMissionWorkflow(
    missionId!,
    {
      action: 'assign',
      assignee_type: 'user',
      assignee_id: assigneeId,
      idempotency_key: `pilot-assign-${missionId}`,
      reason: '8B.7G pilot assignment',
    },
    auth,
  )

  const pkgResult = await generateOfflinePackageForMission(missionId!, {
    actor_id: auth.userId,
    idempotency_key: `pilot-pkg-${missionId}`,
    permissions: ['offline_packages.generate', 'offline_packages.view', 'offline_packages.download'],
  })

  const state: PilotState = {
    organization_id: String(org.id),
    auth_user_id: String(profile.auth_user_id),
    user_profile_id: String(profile.id),
    mission_id: missionId,
    package_id: pkgResult.package?.id ? String(pkgResult.package.id) : undefined,
  }
  saveState(state)

  console.log(
    JSON.stringify(
      {
        phase: '8B.7G-setup',
        project_ref_masked: maskProjectRef(projectRef),
        state: {
          organization_id: state.organization_id,
          mission_id: state.mission_id,
          package_id: state.package_id,
          configure_env: {
            FIELD_REAL_SYNC_PILOT_ENABLED: 'true',
            FIELD_SYNC_PILOT_ORG_IDS: state.organization_id,
            FIELD_SYNC_PILOT_USER_IDS: state.auth_user_id,
            FIELD_SYNC_PILOT_MISSION_IDS: state.mission_id,
          },
        },
      },
      null,
      2,
    ),
  )
  return state
}

/** Minimal valid JPEG bytes for controlled pilot upload */
function pilotPhotoBytes(): Buffer {
  return Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA8A/9k=',
    'base64',
  )
}

/** Generic internal test coordinate — not a real field site. */
const PILOT_LOCATION = {
  type: 'Point' as const,
  coordinates: [-90.5133, 14.6349] as [number, number],
}

async function ensurePilotLocation(submissionId: string) {
  const admin = getSupabaseAdmin()
  await admin
    .from('evidence_submissions')
    .update({
      location_geometry: PILOT_LOCATION,
      location_method: 'device_gps',
      location_accuracy_m: 25,
    })
    .eq('id', submissionId)
}

async function runPilotSync(projectRef: string) {
  if (process.env.FIELD_REAL_SYNC_PILOT_ENABLED !== 'true') {
    throw new Error('Set FIELD_REAL_SYNC_PILOT_ENABLED=true in .env before run (server-side only)')
  }

  const state = loadState()
  if (!state.mission_id || !state.auth_user_id) throw new Error('Run setup first')

  resetSupabaseClient()
  const auth = await resolveAdminAuth(state.auth_user_id)
  const missionId = state.mission_id
  const bundleId = state.bundle_id ?? `pilot-bundle-${missionId.slice(0, 8)}`
  const bundleChecksum =
    state.bundle_checksum ?? createHash('sha256').update(bundleId).digest('hex')
  const idempotencyBase = `pilot-${missionId}`

  const registerResult = await registerBundleSync(auth, {
    bundle_id: bundleId,
    bundle_checksum: bundleChecksum,
    mission_id: missionId,
    package_id: state.package_id ?? null,
    idempotency_key: `${idempotencyBase}-register`,
    metadata: { internal_pilot: true, label: PILOT_TAG },
  })

  let submissionId = state.submission_id
  let submissionReplay = false

  if (submissionId) {
    submissionReplay = true
  } else {
    const submissionResult = await createEvidenceSubmission(
      missionId,
      {
        source_type: 'mission_user',
        source_application: 'terramind-field-sync-pilot',
        idempotency_key: `${idempotencyBase}-submission`,
        evidence_type: 'georeferenced_photo',
        title: 'Pilot photo evidence',
        captured_at: new Date().toISOString(),
        location: {
          geometry: PILOT_LOCATION,
          method: 'device_gps',
          accuracy_m: 25,
        },
      },
      auth,
    )
    submissionId = String(submissionResult.submission.id)
    submissionReplay = submissionResult.idempotent_replay
  }

  const existingAssets = await listEvidenceAssets(submissionId)
  if (existingAssets.length === 0) {
    const photo = pilotPhotoBytes()
    const upload = await startEvidenceUploadSession(auth, submissionId, {
      local_asset_id: 'pilot-photo-1',
      mime_type: 'image/jpeg',
      original_filename: 'pilot-photo.jpg',
      expected_size_bytes: photo.length,
      expected_checksum_sha256: createHash('sha256').update(photo).digest('hex'),
      idempotency_key: `${idempotencyBase}-upload`,
    })

    const putRes = await fetch(upload.upload_url, {
      method: 'PUT',
      body: photo,
      headers: { 'Content-Type': 'image/jpeg' },
    })
    if (!putRes.ok) throw new Error(`upload_failed_${putRes.status}`)

    await reportUploadProgress(auth, submissionId, upload.upload_session_id, {
      bytes_transferred: photo.length,
      status: 'uploading',
    })

    await confirmEvidenceUpload(submissionId, {
      upload_session_id: upload.upload_session_id,
      storage_path: upload.storage_path,
      mime_type: 'image/jpeg',
      original_filename: 'pilot-photo.jpg',
      checksum_sha256: createHash('sha256').update(photo).digest('hex'),
      size_bytes: photo.length,
      idempotency_key: `${idempotencyBase}-confirm`,
      actor_id: auth.userId,
    })
  }

  await ensurePilotLocation(submissionId)

  await addStructuredObservation(submissionId, {
    fields: {
      visible_smoke: 'no',
      visible_flame: 'no',
      observer_notes: '8B.7G internal pilot — controlled verification note, not environmental confirmation.',
    },
    actor_id: auth.userId,
  })

  const reqs = await listMissionEvidenceRequirements(missionId)
  const photoReq = reqs.find((r) => String(r.evidence_type) === 'georeferenced_photo')
  if (photoReq?.id) {
    await linkSubmissionRequirements(auth, submissionId, [
      {
        requirement_id: String(photoReq.id),
        match_type: 'matched',
        match_score: 1,
        match_reason: '8B.7G controlled pilot',
        preliminary_coverage: 'matched',
      },
    ])
  }

  const finalize = await finalizeSubmissionIntake(auth, submissionId, auth.userId)
  const reconciliation = await getSubmissionReconciliation(auth, submissionId)

  await completeBundleRegistration(String(registerResult.registration_id), {
    status: 'synced',
    remote_submission_ids: [submissionId],
  })

  // Idempotency replay
  await registerBundleSync(auth, {
    bundle_id: bundleId,
    bundle_checksum: bundleChecksum,
    mission_id: missionId,
    package_id: state.package_id ?? null,
    idempotency_key: `${idempotencyBase}-register`,
    metadata: { internal_pilot: true },
  })
  await finalizeSubmissionIntake(auth, submissionId, auth.userId)

  state.bundle_id = bundleId
  state.bundle_checksum = bundleChecksum
  state.submission_id = submissionId
  saveState(state)

  console.log(
    JSON.stringify(
      {
        phase: '8B.7G-run',
        project_ref_masked: maskProjectRef(projectRef),
        submission_id: submissionId,
        submission_status: finalize.status,
        reconciliation,
        idempotent_replay: {
          register: registerResult.idempotent_replay,
          submission: submissionReplay,
        },
      },
      null,
      2,
    ),
  )
}

async function resolvePilotMissionId(admin: ReturnType<typeof getSupabaseAdmin>, state: PilotState) {
  const missionId = state.mission_id ?? ''
  if (missionId && !missionId.includes('…')) return missionId

  const bundleId = state.bundle_id ?? ''
  if (bundleId) {
    const { data: reg } = await admin
      .from('evidence_bundle_sync_registrations')
      .select('mission_id')
      .eq('bundle_id', bundleId)
      .maybeSingle()
    if (reg?.mission_id) return String(reg.mission_id)
  }

  const { data: missions } = await admin
    .from('missions')
    .select('id, created_at')
    .contains('source_snapshot', { internal_pilot: true })
    .order('created_at', { ascending: false })
    .limit(5)
  if (!missions?.length) throw new Error('Pilot mission not found remotely')
  return String(missions[0].id)
}

async function resolvePilotSubmissionId(
  admin: ReturnType<typeof getSupabaseAdmin>,
  state: PilotState,
  missionId: string,
) {
  const submissionId = state.submission_id ?? ''
  if (submissionId && !submissionId.includes('…')) return submissionId
  const { data: submission } = await admin
    .from('evidence_submissions')
    .select('id')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!submission?.id) throw new Error('Pilot submission not found remotely')
  return String(submission.id)
}

async function runVerify(projectRef: string) {
  resetSupabaseClient()
  const admin = getSupabaseAdmin()
  const state = loadState()
  const missionId = await resolvePilotMissionId(admin, state)
  const submissionId = await resolvePilotSubmissionId(admin, state, missionId)
  const bundleId = state.bundle_id ?? `pilot-bundle-${missionId.slice(0, 8)}`

  const { count: submissionCount } = await admin
    .from('evidence_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('mission_id', missionId)

  const { count: syncRegCount } = await admin
    .from('evidence_bundle_sync_registrations')
    .select('*', { count: 'exact', head: true })
    .eq('bundle_id', bundleId)

  const { data: submission } = await admin
    .from('evidence_submissions')
    .select('id, status, mission_id, organization_id')
    .eq('id', submissionId)
    .single()

  const { count: validationJobs } = await admin
    .from('evidence_validation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('submission_id', submissionId)

  const { count: uploadSessions } = await admin
    .from('evidence_upload_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('submission_id', submissionId)

  console.log(
    JSON.stringify(
      {
        phase: '8B.7G-verify',
        project_ref_masked: maskProjectRef(projectRef),
        pilot_submissions: submissionCount,
        sync_registrations_for_bundle: syncRegCount,
        upload_sessions_for_submission: uploadSessions,
        submission: submission
          ? {
              id: `${String(submission.id).slice(0, 8)}…`,
              status: submission.status,
              mission_id: `${String(submission.mission_id).slice(0, 8)}…`,
            }
          : null,
        validation_jobs: validationJobs,
        policy: parseRealSyncPilotPolicyFromEnv(process.env),
        global_real_sync_enabled: false,
      },
      null,
      2,
    ),
  )
}

async function runCleanup(projectRef: string) {
  resetSupabaseClient()
  const admin = getSupabaseAdmin()
  const { count: deletedSessions } = await admin
    .from('evidence_upload_sessions')
    .delete({ count: 'exact' })
    .eq('status', 'failed')

  console.log(
    JSON.stringify(
      {
        phase: '8B.7G-cleanup',
        project_ref_masked: maskProjectRef(projectRef),
        failed_upload_sessions_removed: deletedSessions ?? 0,
        preserved: ['pilot mission', 'submission', 'assets', 'audit trail'],
        note: 'Allowlist and pilot env vars must be cleared manually from .env',
      },
      null,
      2,
    ),
  )
}

async function main() {
  const argv = process.argv.slice(2)
  const mode = parseMode(argv)
  const url = requireEnv('SUPABASE_URL')
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const projectRef = extractProjectRef(url)
  const confirm = parseConfirmProject(argv)
  if (confirm !== projectRef) {
    throw new Error(`project mismatch expected ${maskProjectRef(projectRef)}`)
  }
  console.log(`Pilot target confirmed: ${maskProjectRef(projectRef)}`)

  if (mode === 'preflight') {
    await runPreflight(projectRef)
    return
  }

  switch (mode) {
    case 'setup':
      await runSetup(projectRef)
      break
    case 'run':
      await runPilotSync(projectRef)
      break
    case 'verify':
      await runVerify(projectRef)
      break
    case 'cleanup':
      await runCleanup(projectRef)
      break
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
