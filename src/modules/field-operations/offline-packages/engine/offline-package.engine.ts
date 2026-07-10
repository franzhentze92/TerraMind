import {
  DEFAULT_EXPECTED_ACCURACY_M,
  FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
  GENERAL_FIELD_INSTRUCTIONS,
  OFFLINE_CAPABLE_MISSION_TYPES,
  OFFLINE_PACKAGE_BLOCKED_STATUSES,
  OFFLINE_PACKAGE_ELIGIBLE_STATUSES,
  OFFLINE_PACKAGE_HISTORICAL_STATUSES,
  PACKAGE_VALIDITY_HOURS,
  SAFETY_INSTRUCTIONS,
  SENSITIVE_FIELD_PATHS,
  formsForMissionType,
} from '@/modules/field-operations/offline-packages/config/fire-offline-package.config'
import { assertSafeOfflinePackageCopy, scanOfflinePackagePayloads } from '@/modules/field-operations/offline-packages/offline-package-copy-guard'
import { canonicalJson, buildManifestFiles, buildSignedManifest } from '@/modules/field-operations/offline-packages/offline-package-canonical'
import type {
  OfflinePackageBuildInput,
  OfflinePackageBuildResult,
  OfflinePackageEligibilityResult,
  OfflineRedactionRecord,
} from '@/modules/field-operations/offline-packages/offline-package.types'
import {
  criteriaText,
  hashOfflinePackageContext,
} from '@/modules/field-operations/offline-packages/offline-package.types'

function parseGeometryCentroid(
  geometry: Record<string, unknown> | null,
): { lat: number; lng: number } | null {
  if (!geometry) return null
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates as number[]
    return { lat, lng }
  }
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    const ring = (geometry.coordinates as number[][][])[0]
    if (!ring?.length) return null
    const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length
    const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length
    return { lat, lng }
  }
  return null
}

function boundingBoxFromGeometry(
  geometry: Record<string, unknown> | null,
): [number, number, number, number] | null {
  if (!geometry) return null
  const coords: number[][] = []
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates as number[]
    return [lng, lat, lng, lat]
  }
  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates)) {
    for (const point of (geometry.coordinates as number[][][])[0] ?? []) {
      coords.push(point)
    }
  }
  if (coords.length === 0) return null
  const lngs = coords.map((c) => c[0])
  const lats = coords.map((c) => c[1])
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

export function evaluateOfflinePackageEligibility(input: {
  mission: Record<string, unknown>
  tasks: Array<Record<string, unknown>>
  evidence_requirements: Array<Record<string, unknown>>
  assignment: Record<string, unknown> | null
  allow_historical?: boolean
  nowIso: string
}): OfflinePackageEligibilityResult {
  const status = String(input.mission.status)
  const missionType = String(input.mission.mission_type)
  const reasons: string[] = []

  if ((OFFLINE_PACKAGE_BLOCKED_STATUSES as readonly string[]).includes(status)) {
    return { eligible: false, reasons: ['mission_status_draft'], requires_assignment: false }
  }

  const historical =
    input.allow_historical &&
    (OFFLINE_PACKAGE_HISTORICAL_STATUSES as readonly string[]).includes(status)
  const operational = (OFFLINE_PACKAGE_ELIGIBLE_STATUSES as readonly string[]).includes(status)

  if (!operational && !historical) {
    return { eligible: false, reasons: [`mission_status_${status}`], requires_assignment: false }
  }

  if (!(OFFLINE_CAPABLE_MISSION_TYPES as readonly string[]).includes(missionType)) {
    reasons.push('mission_type_not_offline_capable')
  }

  if (input.tasks.length === 0) reasons.push('missing_tasks')
  if (input.evidence_requirements.length === 0) reasons.push('missing_evidence_requirements')

  const geometry = input.mission.location_geometry as Record<string, unknown> | null
  const description = String(input.mission.location_description ?? '').trim()
  if (!geometry && !description) reasons.push('missing_location')

  const expiresAt = String(input.mission.expires_at ?? '')
  if (expiresAt && Date.parse(expiresAt) < Date.parse(input.nowIso) && !historical) {
    reasons.push('mission_expired')
  }

  const requiresAssignment = ['assigned', 'in_progress'].includes(status)
  if (requiresAssignment && !input.assignment && operational) {
    reasons.push('assignment_required')
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    requires_assignment: requiresAssignment,
  }
}

export function applyOfflineDataRedaction(input: {
  mission: Record<string, unknown>
  incident: Record<string, unknown> | null
  canViewSensitive: boolean
}): { mission: Record<string, unknown>; incident: Record<string, unknown> | null; redaction: OfflineRedactionRecord } {
  const excluded: string[] = []
  const generalized: string[] = []

  const mission = { ...input.mission }
  const incident = input.incident ? { ...input.incident } : null

  for (const path of SENSITIVE_FIELD_PATHS) {
    if (path in mission) {
      delete mission[path]
      excluded.push(`mission.${path}`)
    }
    if (incident && path in incident) {
      delete incident[path]
      excluded.push(`incident.${path}`)
    }
  }

  if (!input.canViewSensitive && mission.location_geometry) {
    const geometry = mission.location_geometry as Record<string, unknown>
    if (geometry.type === 'Point') {
      mission.location_geometry = {
        type: 'Point',
        coordinates: (geometry.coordinates as number[]).map((v) => Math.round(v * 1000) / 1000),
      }
      generalized.push('mission.location_geometry')
    }
  }

  if (incident?.source_snapshot) {
    delete incident.source_snapshot
    excluded.push('incident.source_snapshot')
  }

  return {
    mission,
    incident,
    redaction: {
      excluded_fields: excluded.sort(),
      generalized_fields: generalized.sort(),
      policy_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
    },
  }
}

function buildContextSignatureInput(input: OfflinePackageBuildInput): Record<string, unknown> {
  const sortedTasks = [...input.tasks].sort(
    (a, b) => Number(a.sequence) - Number(b.sequence) || String(a.id).localeCompare(String(b.id)),
  )
  const sortedEvidence = [...input.evidence_requirements].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  )
  return {
    mission_id: input.mission.id,
    mission_type: input.mission.mission_type,
    title: input.mission.title,
    objective: input.mission.objective,
    status: input.mission.status,
    location_geometry: input.mission.location_geometry,
    location_description: input.mission.location_description,
    earliest_start_at: input.mission.earliest_start_at,
    due_at: input.mission.due_at,
    expires_at: input.mission.expires_at,
    completion_criteria: input.mission.completion_criteria,
    inconclusive_criteria: input.mission.inconclusive_criteria,
    blocking_conditions: input.mission.blocking_conditions,
    cancellation_conditions: input.mission.cancellation_conditions,
    mission_profile_version: input.mission.mission_profile_version,
    tasks: sortedTasks.map((t) => ({
      id: t.id,
      sequence: t.sequence,
      task_type: t.task_type,
      title: t.title,
      instructions: t.instructions,
      required: t.required,
      completion_criteria: t.completion_criteria,
    })),
    evidence_requirements: sortedEvidence.map((r) => ({
      id: r.id,
      evidence_type: r.evidence_type,
      required: r.required,
      minimum_count: r.minimum_count,
      required_metadata: r.required_metadata,
      quality_criteria: r.quality_criteria,
      acceptance_criteria: r.acceptance_criteria,
      verification_need_id: r.verification_need_id,
    })),
    forms: formsForMissionType(String(input.mission.mission_type)).map((f) => f.schema_id),
    offline_package_model_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
  }
}

export function buildOfflinePackageContextSignature(input: OfflinePackageBuildInput): string {
  return hashOfflinePackageContext(buildContextSignatureInput(input))
}

export function hasMaterialPackageChange(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  return canonicalJson(previous) !== canonicalJson(next)
}

function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * 3_600_000).toISOString()
}

export function buildOfflinePackage(input: OfflinePackageBuildInput & {
  package_id: string
  package_version: number
  supersedes_package_id?: string | null
  signingKey?: string | null
}): OfflinePackageBuildResult {
  const eligibility = evaluateOfflinePackageEligibility({
    mission: input.mission,
    tasks: input.tasks,
    evidence_requirements: input.evidence_requirements,
    assignment: input.assignment,
    allow_historical: input.allow_historical,
    nowIso: input.evaluated_at,
  })

  const context_signature = buildOfflinePackageContextSignature(input)
  if (!eligibility.eligible) {
    return {
      decision: 'not_eligible',
      context_signature,
      package_version: input.package_version,
      supersedes_package_id: input.supersedes_package_id ?? null,
      valid_from: input.evaluated_at,
      valid_until: input.evaluated_at,
      download_expires_at: input.evaluated_at,
      snapshot: {
        mission: {} as OfflinePackageBuildResult['snapshot']['mission'],
        origin: {} as OfflinePackageBuildResult['snapshot']['origin'],
        location: {} as OfflinePackageBuildResult['snapshot']['location'],
        tasks: [],
        evidence_requirements: [],
        forms: [],
        permissions: {
          allowed_actions: [],
          sensitivity_level: 'minimal',
          can_view_sensitive_location: false,
        },
        instructions: { general: '', safety: [] },
        map_resources: {},
      },
      payloads: [],
      redaction: { excluded_fields: [], generalized_fields: [], policy_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION },
      reasons: eligibility.reasons,
      warnings: [],
    }
  }

  const canViewSensitive = input.permissions.includes('offline_packages.view_sensitive')
  const redacted = applyOfflineDataRedaction({
    mission: input.mission,
    incident: input.incident,
    canViewSensitive,
  })

  const missionType = String(redacted.mission.mission_type)
  const forms = formsForMissionType(missionType)
  const geometry = redacted.mission.location_geometry as Record<string, unknown> | null
  const centroid = parseGeometryCentroid(geometry)
  const bounding_box = boundingBoxFromGeometry(geometry)

  const sortedTasks = [...input.tasks].sort(
    (a, b) => Number(a.sequence) - Number(b.sequence) || String(a.id).localeCompare(String(b.id)),
  )
  const sortedEvidence = [...input.evidence_requirements].sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  )

  const missionSnapshot = {
    mission_id: String(redacted.mission.id),
    title: String(redacted.mission.title),
    objective: String(redacted.mission.objective),
    mission_type: missionType,
    priority: Number(redacted.mission.priority),
    status: String(redacted.mission.status),
    earliest_start_at: String(redacted.mission.earliest_start_at),
    due_at: String(redacted.mission.due_at),
    expires_at: String(redacted.mission.expires_at),
    completion_criteria: criteriaText(redacted.mission.completion_criteria),
    inconclusive_criteria: criteriaText(redacted.mission.inconclusive_criteria),
    blocking_conditions: (redacted.mission.blocking_conditions as string[]) ?? [],
    cancellation_conditions: (redacted.mission.cancellation_conditions as string[]) ?? [],
    operational_window: {
      earliest_start_at: String(redacted.mission.earliest_start_at),
      due_at: String(redacted.mission.due_at),
      expires_at: String(redacted.mission.expires_at),
    },
  }

  assertSafeOfflinePackageCopy(missionSnapshot.objective, 'objective')
  assertSafeOfflinePackageCopy(GENERAL_FIELD_INSTRUCTIONS, 'instructions.general')

  const needs = input.plan_needs.map((n) => ({
    id: String(n.id),
    need_type: String(n.need_type),
    need_question: String(n.need_question),
    priority: Number(n.priority),
    recommended_method_code: n.recommended_method_id ? String(n.recommended_method_id) : null,
  }))

  const sourceSnapshot = (redacted.mission.source_snapshot as Record<string, unknown>) ?? {}
  const originSnapshot = {
    incident_id: String(redacted.mission.incident_id),
    verification_plan_id: String(redacted.mission.verification_plan_id),
    verification_needs: needs,
    recommended_method_code: String(redacted.mission.recommended_method_code),
    primary_reasons: ((sourceSnapshot.reasons as string[]) ?? []).slice(0, 5),
    limitations: ((sourceSnapshot.eligibility as { limitations?: string[] })?.limitations ?? []).slice(
      0,
      5,
    ),
    safe_summary: 'Paquete operacional para verificación en campo con lenguaje conservador.',
  }

  const locationSnapshot = {
    geometry,
    centroid,
    bounding_box,
    location_description: String(redacted.mission.location_description ?? ''),
    expected_accuracy_m: DEFAULT_EXPECTED_ACCURACY_M,
    restricted_zones: [],
    capture_area: geometry,
    territorial_references: descriptionReferences(String(redacted.mission.location_description ?? '')),
  }

  const taskSnapshots = sortedTasks.map((task, index) => ({
    id: String(task.id),
    sequence: Number(task.sequence),
    task_type: String(task.task_type),
    title: String(task.title),
    instructions: String(task.instructions),
    required: Boolean(task.required),
    completion_criteria: criteriaText(task.completion_criteria),
    dependencies: index > 0 ? [String(sortedTasks[index - 1]?.id)] : [],
    blockers: [],
    initial_status: String(task.status ?? 'pending'),
    form_schema_id: forms[0]?.schema_id ?? null,
  }))

  const evidenceSnapshots = sortedEvidence.map((req) => ({
    id: String(req.id),
    verification_need_id: req.verification_need_id ? String(req.verification_need_id) : null,
    evidence_type: String(req.evidence_type),
    required: Boolean(req.required),
    minimum_count: Number(req.minimum_count),
    required_metadata: (req.required_metadata as string[]) ?? [],
    quality_criteria: (req.quality_criteria as string[]) ?? [],
    acceptance_criteria: criteriaText(req.acceptance_criteria),
    capture_instructions: captureInstructionsFor(String(req.evidence_type)),
  }))

  const permissionsSnapshot = {
    allowed_actions: ['view_package', 'validate_integrity'],
    sensitivity_level: canViewSensitive ? ('standard' as const) : ('restricted' as const),
    can_view_sensitive_location: canViewSensitive,
  }

  const mapResources = {
    version: '1',
    geojson_layers: geometry ? [{ name: 'mission_area', geometry }] : [],
    bounding_box,
    points_of_interest: centroid ? [{ type: 'centroid', ...centroid }] : [],
    tile_manifest: { enabled: false, max_zoom: 14, note: 'Reserved for 8B.7B+' },
  }

  const snapshot = {
    mission: missionSnapshot,
    origin: originSnapshot,
    location: locationSnapshot,
    tasks: taskSnapshots,
    evidence_requirements: evidenceSnapshots,
    forms,
    permissions: permissionsSnapshot,
    instructions: { general: GENERAL_FIELD_INSTRUCTIONS, safety: SAFETY_INSTRUCTIONS },
    map_resources: mapResources,
  }

  const payloads = [
    { path: 'mission.json', mime_type: 'application/json', content: canonicalJson(missionSnapshot) },
    { path: 'origin.json', mime_type: 'application/json', content: canonicalJson(originSnapshot) },
    { path: 'location.json', mime_type: 'application/json', content: canonicalJson(locationSnapshot) },
    { path: 'tasks.json', mime_type: 'application/json', content: canonicalJson(taskSnapshots) },
    {
      path: 'evidence-requirements.json',
      mime_type: 'application/json',
      content: canonicalJson(evidenceSnapshots),
    },
    { path: 'forms.json', mime_type: 'application/json', content: canonicalJson(forms) },
    {
      path: 'permissions.json',
      mime_type: 'application/json',
      content: canonicalJson(permissionsSnapshot),
    },
    {
      path: 'instructions.json',
      mime_type: 'application/json',
      content: canonicalJson(snapshot.instructions),
    },
    {
      path: 'map-resources.json',
      mime_type: 'application/json',
      content: canonicalJson(mapResources),
    },
    {
      path: 'redaction.json',
      mime_type: 'application/json',
      content: canonicalJson(redacted.redaction),
    },
  ]

  const violations = scanOfflinePackagePayloads(payloads)
  if (violations.length > 0) {
    throw new Error(`Copy prohibido en paquete: ${violations.join(', ')}`)
  }

  const valid_from = input.evaluated_at
  const missionExpires = String(redacted.mission.expires_at)
  const packageValidity = addHours(input.evaluated_at, PACKAGE_VALIDITY_HOURS)
  const valid_until =
    Date.parse(missionExpires) < Date.parse(packageValidity) ? missionExpires : packageValidity
  const download_expires_at = addHours(input.evaluated_at, 24)

  const files = buildManifestFiles(payloads)
  const manifest = buildSignedManifest({
    package_id: input.package_id,
    package_version: input.package_version,
    mission_id: String(redacted.mission.id),
    mission_profile_version: String(redacted.mission.mission_profile_version),
    offline_package_model_version: FIRE_OFFLINE_PACKAGE_MODEL_VERSION,
    generated_at: input.evaluated_at,
    generated_by: input.actor_id,
    valid_from,
    valid_until,
    supersedes_package_id: input.supersedes_package_id ?? null,
    context_signature,
    files,
    map_resource_manifest: mapResources.tile_manifest as Record<string, unknown>,
    signingKey: input.signingKey,
  })

  payloads.push({
    path: 'manifest.json',
    mime_type: 'application/json',
    content: canonicalJson(manifest),
  })

  return {
    decision: 'generate_package',
    context_signature,
    package_version: input.package_version,
    supersedes_package_id: input.supersedes_package_id ?? null,
    valid_from,
    valid_until,
    download_expires_at,
    snapshot,
    payloads,
    redaction: redacted.redaction,
    reasons: ['eligible_mission'],
    warnings: eligibility.requires_assignment ? ['assignment_policy_applied'] : [],
  }
}

function descriptionReferences(description: string): string[] {
  return description
    .split(/[,;]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function captureInstructionsFor(evidenceType: string): string {
  switch (evidenceType) {
    case 'georeferenced_photo':
      return 'Capturar fotografía con coordenadas y orientación aproximada.'
    case 'structured_observation':
      return 'Completar observación estructurada sin inferir confirmación.'
    case 'drone_image':
      return 'Registrar imagen aérea con metadata de vuelo y área observada.'
    default:
      return 'Registrar evidencia según criterios mínimos del requisito.'
  }
}

export function nextPackageVersion(existingVersions: number[]): number {
  if (existingVersions.length === 0) return 1
  return Math.max(...existingVersions) + 1
}
