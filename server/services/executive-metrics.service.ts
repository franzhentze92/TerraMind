/**
 * Executive Metrics Service — the single canonical resolver for every headline
 * count in TerraMind.
 *
 * Product Consolidation — Phase 1. Situación Nacional, cards and reports all
 * consume this. It resolves each count once, applies scope + active
 * organization, excludes demo by default, separates legacy, documents pending,
 * and returns a full breakdown + source + timestamp for every metric. No page
 * may recompute these numbers on its own.
 */

import type { RequestAuthContext } from '@/core/auth/permissions'
import {
  isInternalDemoIncidentId,
  isInternalDemoMissionTitle,
} from '@/modules/executive-demo/demo-config'
import type {
  DataQualitySummary,
  ExecutiveMetric,
  MetricBreakdownItem,
} from '@/modules/executive-metrics/executive-metric.types'
import {
  getMetricRegistryEntry,
  type MetricRegistryEntry,
} from '@/modules/executive-metrics/metric-registry'
import {
  resolveTimeWindow,
  TIME_WINDOWS,
} from '@/modules/executive-metrics/metric-taxonomy'
import { classificationLabel } from '@/shared/product-language'
import { FIRE_VERIFICATION_MODEL_VERSION } from '@/modules/verification/config/fire-verification.config'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client.js'
import { listIncidents } from '@/pipeline/stores/incidents.store.js'
import { listMissions } from '@/pipeline/stores/missions.store.js'
import {
  listVerificationNeedsForPlan,
  listVerificationPlans,
} from '@/pipeline/stores/verification-plans.store.js'
import { getFireSummary } from './fire-summary.service.js'
import { getSituationReport } from '@/pipeline/orchestrator'

export interface ExecutiveMetricsOptions {
  include_demo?: boolean
  include_legacy?: boolean
}

/* -------------------------------------------------------------------------- */
/* Low level counters                                                          */
/* -------------------------------------------------------------------------- */

async function countFindingsByStatus(status?: string): Promise<number> {
  let query = getSupabaseAdmin()
    .from('composite_findings')
    .select('id', { head: true, count: 'exact' })
  if (status) query = query.eq('status', status)
  const { count, error } = await query
  if (error) return 0
  return count ?? 0
}

async function countActivePriorities(): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('finding_priority_assessments')
    .select('id', { head: true, count: 'exact' })
    .eq('assessment_status', 'active')
    .eq('entity_type', 'fire_event')
  if (error) return 0
  return count ?? 0
}

async function countActiveResponseAssessments(organizationId: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from('response_assessments')
    .select('id', { head: true, count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('is_active', true)
  if (error) return 0
  return count ?? 0
}

/* -------------------------------------------------------------------------- */
/* Classification of tenant-scoped rows                                        */
/* -------------------------------------------------------------------------- */

type RowClass = 'operational' | 'legacy' | 'demo' | 'out_of_scope'

interface ClassifiedCounts {
  operational: number
  legacy: number
  demo: number
  outOfScope: number
}

function emptyCounts(): ClassifiedCounts {
  return { operational: 0, legacy: 0, demo: 0, outOfScope: 0 }
}

/* -------------------------------------------------------------------------- */
/* Metric builder (registry is the source of truth for metadata)              */
/* -------------------------------------------------------------------------- */

interface BuildMetricInput {
  metricId: string
  value: number
  breakdown: MetricBreakdownItem[]
  lastUpdatedAt?: string | null
  timeWindowOverride?: { from?: string | null; to?: string | null }
}

function buildMetric(input: BuildMetricInput): ExecutiveMetric {
  const entry = getMetricRegistryEntry(input.metricId) as MetricRegistryEntry
  if (!entry) {
    throw new Error(`Metric "${input.metricId}" is not registered in metric-registry.ts`)
  }
  const windowDef = TIME_WINDOWS[entry.time_window]
  const resolved = resolveTimeWindow(entry.time_window)
  return {
    id: entry.metric_id,
    label: entry.label,
    value: input.value,
    scope: entry.scope,
    classification: entry.scope === 'demo' ? 'demo' : 'operational',
    timeWindow: {
      key: entry.time_window,
      label: windowDef.label,
      from: input.timeWindowOverride?.from ?? resolved.from,
      to: input.timeWindowOverride?.to ?? resolved.to,
    },
    breakdown: input.breakdown,
    source: entry.source_table_or_service,
    lastUpdatedAt: input.lastUpdatedAt ?? null,
    limitations: entry.confidence_or_limitations ? [entry.confidence_or_limitations] : [],
  }
}

function operationalSlice(value: number, label = 'Operacionales'): MetricBreakdownItem {
  return { label, value, included: true, classification: 'operational' }
}

function legacySlice(value: number): MetricBreakdownItem {
  return {
    label: 'Legacy sin organización',
    value,
    included: false,
    classification: 'legacy',
    reason: 'ownership_unresolved',
  }
}

function demoSlice(value: number): MetricBreakdownItem {
  return {
    label: 'Demostración interna',
    value,
    included: false,
    classification: 'demo',
    reason: 'demo',
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export interface FireContext {
  observations_downloaded: number
  detections_count: number
  events_count: number
  attention_events_count: number
  window_start_utc: string
  window_end_utc: string
  generated_at: string
}

export interface ResolvedContext {
  fire: FireContext
  incidents: ClassifiedCounts
  missions: ClassifiedCounts
  evidence: ClassifiedCounts
  findingsActive: number
  findingsMonitoring: number
  findingsResolved: number
  findingsTotal: number
  priorities: number
  verificationPlansLegacy: number
  verificationNeedsActive: number
  responseAssessments: number
  sourcesActive: number
  lastSyncAt: string | null
}

async function classifyIncidents(auth: RequestAuthContext): Promise<ClassifiedCounts> {
  const rows = (await listIncidents({ limit: 500 })) as Array<{
    id: string
    organization_id?: string | null
    status?: string
  }>
  const counts = emptyCounts()
  for (const row of rows) {
    const id = String(row.id)
    const orgId = row.organization_id ?? null
    let klass: RowClass
    if (isInternalDemoIncidentId(id)) klass = 'demo'
    else if (orgId == null) klass = 'legacy'
    else if (orgId === auth.activeOrganizationId || auth.isPlatformAdmin) klass = 'operational'
    else klass = 'out_of_scope'
    counts[klass === 'out_of_scope' ? 'outOfScope' : klass] += 1
  }
  return counts
}

async function classifyMissions(auth: RequestAuthContext): Promise<ClassifiedCounts> {
  const rows = (await listMissions({ limit: 500 })) as Array<{
    id: string
    title?: string
    organization_id?: string | null
  }>
  const counts = emptyCounts()
  for (const row of rows) {
    const isDemo = isInternalDemoMissionTitle(String(row.title ?? ''))
    const orgId = row.organization_id ?? null
    if (isDemo) counts.demo += 1
    else if (orgId == null) counts.legacy += 1
    else if (orgId === auth.activeOrganizationId || auth.isPlatformAdmin) counts.operational += 1
    else counts.outOfScope += 1
  }
  return counts
}

async function classifyEvidence(auth: RequestAuthContext): Promise<ClassifiedCounts> {
  const missions = (await listMissions({ limit: 500 })) as Array<{
    id: string
    title?: string
    organization_id?: string | null
  }>
  const pilotMissionIds = new Set(
    missions.filter((m) => isInternalDemoMissionTitle(String(m.title ?? ''))).map((m) => String(m.id)),
  )
  const missionOrg = new Map(missions.map((m) => [String(m.id), m.organization_id ?? null]))

  const { data } = await getSupabaseAdmin()
    .from('evidence_submissions')
    .select('id, mission_id, organization_id')
    .limit(2000)
  const counts = emptyCounts()
  for (const row of (data ?? []) as Array<{ mission_id?: string; organization_id?: string | null }>) {
    const missionId = String(row.mission_id ?? '')
    const orgId = row.organization_id ?? missionOrg.get(missionId) ?? null
    if (pilotMissionIds.has(missionId)) counts.demo += 1
    else if (orgId == null) counts.legacy += 1
    else if (orgId === auth.activeOrganizationId || auth.isPlatformAdmin) counts.operational += 1
    else counts.outOfScope += 1
  }
  return counts
}

async function resolveVerification(): Promise<{ legacyPlans: number; activeNeeds: number }> {
  const plans = (await listVerificationPlans({ limit: 200 })) as Array<{
    id: string
    verification_model_version?: string
    organization_id?: string | null
    status?: string
  }>
  let legacyPlans = 0
  let activeNeeds = 0
  for (const plan of plans) {
    const isCurrentModel = plan.verification_model_version === FIRE_VERIFICATION_MODEL_VERSION
    const hasOwner = (plan.organization_id ?? null) != null
    const isOperational = isCurrentModel && hasOwner
    if (!isOperational) {
      legacyPlans += 1
      continue
    }
    const needs = (await listVerificationNeedsForPlan(String(plan.id))) as Array<{
      resolution_status?: string
    }>
    activeNeeds += needs.filter(
      (n) => !['satisfied', 'not_required', 'resolved'].includes(String(n.resolution_status ?? '')),
    ).length
  }
  return { legacyPlans, activeNeeds }
}

async function resolveContext(auth: RequestAuthContext): Promise<ResolvedContext> {
  const [
    fire,
    incidents,
    missions,
    evidence,
    findingsActive,
    findingsMonitoring,
    findingsResolved,
    findingsTotal,
    priorities,
    verification,
    responseAssessments,
  ] = await Promise.all([
    getFireSummary(),
    classifyIncidents(auth),
    classifyMissions(auth),
    classifyEvidence(auth),
    countFindingsByStatus('active'),
    countFindingsByStatus('monitoring'),
    countFindingsByStatus('resolved'),
    countFindingsByStatus(),
    countActivePriorities(),
    resolveVerification(),
    countActiveResponseAssessments(auth.activeOrganizationId),
  ])

  const situation = getSituationReport()

  return {
    fire,
    incidents,
    missions,
    evidence,
    findingsActive,
    findingsMonitoring,
    findingsResolved,
    findingsTotal,
    priorities,
    verificationPlansLegacy: verification.legacyPlans,
    verificationNeedsActive: verification.activeNeeds,
    responseAssessments,
    sourcesActive: situation.sourcesActive,
    lastSyncAt: situation.lastSyncAt ?? null,
  }
}

export async function getExecutiveMetrics(
  auth: RequestAuthContext,
  options: ExecutiveMetricsOptions = {},
): Promise<ExecutiveMetric[]> {
  const ctx = await resolveContext(auth)
  return buildExecutiveMetricsFromContext(ctx, { include_demo: options.include_demo === true })
}

/**
 * Pure metric assembly from a resolved context. Extracted so consistency rules
 * (demo excluded by default, breakdowns, include_demo never mutates operational
 * value) can be unit-tested without touching the database.
 */
export function buildExecutiveMetricsFromContext(
  ctx: ResolvedContext,
  options: ExecutiveMetricsOptions = {},
): ExecutiveMetric[] {
  const includeDemo = options.include_demo === true
  const fire = ctx.fire
  const fireWindow = { from: fire.window_start_utc, to: fire.window_end_utc }
  const fireUpdated = fire.generated_at

  const metrics: ExecutiveMetric[] = []

  /* ------------------------------- FIRES -------------------------------- */
  metrics.push(
    buildMetric({
      metricId: 'fire_observations',
      value: fire.observations_downloaded,
      breakdown: [operationalSlice(fire.observations_downloaded, 'Observaciones recibidas')],
      lastUpdatedAt: fireUpdated,
      timeWindowOverride: fireWindow,
    }),
    buildMetric({
      metricId: 'fire_detections_national',
      value: fire.detections_count,
      breakdown: [operationalSlice(fire.detections_count, 'Dentro de Guatemala')],
      lastUpdatedAt: fireUpdated,
      timeWindowOverride: fireWindow,
    }),
    buildMetric({
      metricId: 'fire_events',
      value: fire.events_count,
      breakdown: [operationalSlice(fire.events_count, 'Eventos agrupados')],
      lastUpdatedAt: fireUpdated,
      timeWindowOverride: fireWindow,
    }),
    buildMetric({
      metricId: 'fire_events_attention',
      value: fire.attention_events_count,
      breakdown: [operationalSlice(fire.attention_events_count, 'Con atención')],
      lastUpdatedAt: fireUpdated,
      timeWindowOverride: fireWindow,
    }),
  )

  /* ------------------------------ FINDINGS ------------------------------ */
  metrics.push(
    buildMetric({
      metricId: 'findings_active',
      value: ctx.findingsActive,
      breakdown: [
        operationalSlice(ctx.findingsActive, 'Activos'),
        {
          label: 'En monitoreo',
          value: ctx.findingsMonitoring,
          included: false,
          classification: 'operational',
          reason: 'pending_processing',
        },
      ],
    }),
  )

  /* ----------------------------- PRIORITIES ----------------------------- */
  metrics.push(
    buildMetric({
      metricId: 'priorities_total',
      value: ctx.priorities,
      breakdown: [operationalSlice(ctx.priorities, 'Evaluadas')],
    }),
  )

  /* ----------------------------- INCIDENTS ------------------------------ */
  const incidentBreakdown: MetricBreakdownItem[] = [operationalSlice(ctx.incidents.operational)]
  if (ctx.incidents.legacy > 0) incidentBreakdown.push(legacySlice(ctx.incidents.legacy))
  if (includeDemo && ctx.incidents.demo > 0) incidentBreakdown.push(demoSlice(ctx.incidents.demo))
  metrics.push(
    buildMetric({
      metricId: 'incidents_operational',
      value: ctx.incidents.operational,
      breakdown: incidentBreakdown,
    }),
  )

  /* ------------------------------ MISSIONS ------------------------------ */
  const missionBreakdown: MetricBreakdownItem[] = [operationalSlice(ctx.missions.operational)]
  if (ctx.missions.legacy > 0) missionBreakdown.push(legacySlice(ctx.missions.legacy))
  if (includeDemo && ctx.missions.demo > 0) missionBreakdown.push(demoSlice(ctx.missions.demo))
  else if (!includeDemo && ctx.missions.demo > 0)
    missionBreakdown.push({
      label: 'Demostración interna',
      value: ctx.missions.demo,
      included: false,
      classification: 'demo',
      reason: 'demo',
    })
  metrics.push(
    buildMetric({
      metricId: 'missions_operational',
      value: ctx.missions.operational,
      breakdown: missionBreakdown,
    }),
  )

  /* ------------------------------ EVIDENCE ------------------------------ */
  const evidenceBreakdown: MetricBreakdownItem[] = [operationalSlice(ctx.evidence.operational)]
  if (ctx.evidence.legacy > 0) evidenceBreakdown.push(legacySlice(ctx.evidence.legacy))
  if (ctx.evidence.demo > 0) evidenceBreakdown.push(demoSlice(ctx.evidence.demo))
  metrics.push(
    buildMetric({
      metricId: 'evidence_operational',
      value: ctx.evidence.operational,
      breakdown: evidenceBreakdown,
    }),
  )

  /* --------------------------- VERIFICATION ----------------------------- */
  metrics.push(
    buildMetric({
      metricId: 'verification_plans_legacy',
      value: ctx.verificationPlansLegacy,
      breakdown: [
        {
          label: 'Planes legacy',
          value: ctx.verificationPlansLegacy,
          included: true,
          classification: 'legacy',
        },
      ],
    }),
    buildMetric({
      metricId: 'verification_needs_active',
      value: ctx.verificationNeedsActive,
      breakdown: [operationalSlice(ctx.verificationNeedsActive, 'Necesidades activas')],
    }),
  )

  /* ------------------------------ RESPONSE ------------------------------ */
  metrics.push(
    buildMetric({
      metricId: 'response_assessments',
      value: ctx.responseAssessments,
      breakdown: [operationalSlice(ctx.responseAssessments, 'Evaluaciones activas')],
    }),
  )

  /* ------------------------------- SOURCES ------------------------------ */
  metrics.push(
    buildMetric({
      metricId: 'sources_active',
      value: ctx.sourcesActive,
      breakdown: [operationalSlice(ctx.sourcesActive, 'Fuentes conectadas')],
      lastUpdatedAt: ctx.lastSyncAt,
    }),
  )

  return metrics
}

export async function getExecutiveMetric(
  auth: RequestAuthContext,
  metricId: string,
  options: ExecutiveMetricsOptions = {},
): Promise<ExecutiveMetric | null> {
  const metrics = await getExecutiveMetrics(auth, options)
  return metrics.find((m) => m.id === metricId) ?? null
}

/* -------------------------------------------------------------------------- */
/* Data quality summary (spec §10)                                             */
/* -------------------------------------------------------------------------- */

export async function getDataQualitySummary(
  auth: RequestAuthContext,
): Promise<DataQualitySummary> {
  const ctx = await resolveContext(auth)
  return buildDataQualityFromContext(ctx)
}

export function buildDataQualityFromContext(
  ctx: ResolvedContext,
  now: number = Date.now(),
): DataQualitySummary {
  const operationalRecords =
    ctx.incidents.operational +
    ctx.missions.operational +
    ctx.evidence.operational +
    ctx.findingsActive +
    ctx.priorities +
    ctx.responseAssessments
  const legacyRecords =
    ctx.incidents.legacy + ctx.missions.legacy + ctx.evidence.legacy + ctx.verificationPlansLegacy
  const demoRecords = ctx.incidents.demo + ctx.missions.demo + ctx.evidence.demo
  const unresolvedOwnershipRecords = ctx.incidents.legacy + ctx.missions.legacy + ctx.evidence.legacy
  const pendingProcessingRecords = ctx.findingsMonitoring

  const lastSuccessful = ctx.fire.generated_at ?? ctx.lastSyncAt
  const ageMinutes = lastSuccessful
    ? (now - new Date(lastSuccessful).getTime()) / 60000
    : Number.POSITIVE_INFINITY
  let freshnessStatus: DataQualitySummary['freshnessStatus'] = 'fresh'
  if (ageMinutes > 24 * 60) freshnessStatus = 'stale'
  else if (ageMinutes > 3 * 60) freshnessStatus = 'delayed'

  const warnings: string[] = []
  if (legacyRecords > 0)
    warnings.push(
      `${legacyRecords} registro(s) legacy con ${classificationLabel('unresolved_ownership').toLowerCase()}`,
    )
  if (freshnessStatus !== 'fresh') warnings.push('Los datos podrían no estar actualizados')

  return {
    operationalRecords,
    legacyRecords,
    demoRecords,
    unresolvedOwnershipRecords,
    pendingProcessingRecords,
    freshnessStatus,
    lastSuccessfulUpdateAt: lastSuccessful ?? null,
    warnings,
  }
}
