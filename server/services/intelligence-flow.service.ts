import type { RequestAuthContext } from '@/core/auth/permissions'
import { isInternalDemoIncidentId, isInternalDemoMissionTitle } from '@/modules/executive-demo/demo-config'
import type {
  IntelligenceFlowDto,
  IntelligenceFlowNode,
  IntelligenceFlowNodeStatus,
  IntelligenceFlowResourceType,
  IntelligenceFlowStage,
} from '@/modules/intelligence-flow/intelligence-flow.types'
import { FLOW_STAGE_LABELS } from '@/modules/intelligence-flow/intelligence-flow.constants'
import { getCompositeFindingById, listCompositeFindings } from '@/pipeline/stores/composite-findings.store.js'
import { listEvidenceSubmissionsByIncident } from '@/pipeline/stores/evidence-intake.store.js'
import { getIncidentById, getIncidentForFireEvent } from '@/pipeline/stores/incidents.store.js'
import { listMissions } from '@/pipeline/stores/missions.store.js'
import {
  getActivePriorityAssessment,
  getPriorityAssessmentById,
} from '@/pipeline/stores/priority-assessments.store.js'
import { getActiveAssessmentForIncident } from '@/pipeline/stores/response-orchestration.store.js'
import { getActiveVerificationPlan } from '@/pipeline/stores/verification-plans.store.js'
import { FIRE_VERIFICATION_MODEL_VERSION } from '@/modules/verification/config/fire-verification.config'
import { resolvePriorityModelVersion } from '@/modules/priorities/services/fire-priority-context.loader'
import { getMissionById } from '@/pipeline/stores/missions.store.js'
import { getEvidenceSubmissionById } from '@/pipeline/stores/evidence-intake.store.js'
import { getIncidentVerificationResolution } from './verification-resolution.service.js'

interface ChainSnapshot {
  classification: 'operational' | 'legacy' | 'demo'
  incidentId?: string
  primaryEventId?: string
  findingId?: string
  findingTitle?: string
  priorityId?: string
  verificationPlanId?: string
  verificationSummary?: string
  missionId?: string
  missionTitle?: string
  evidenceId?: string
  evidenceStatus?: string
  hasResolution: boolean
  resolutionSummary?: string
  hasResponse: boolean
  responseSummary?: string
}

function classifyIncident(row: { id: string; organization_id?: string | null }): 'operational' | 'legacy' | 'demo' {
  if (isInternalDemoIncidentId(String(row.id))) return 'demo'
  if (row.organization_id == null) return 'legacy'
  return 'operational'
}

function node(
  stage: IntelligenceFlowStage,
  status: IntelligenceFlowNodeStatus,
  opts: Partial<IntelligenceFlowNode> = {},
): IntelligenceFlowNode {
  return {
    stage,
    status,
    label: FLOW_STAGE_LABELS[stage],
    ...opts,
  }
}

function buildNodes(snap: ChainSnapshot, current: IntelligenceFlowStage): IntelligenceFlowNode[] {
  const nodes: IntelligenceFlowNode[] = []

  nodes.push(
    snap.findingId
      ? node('finding', 'available', {
          resourceId: snap.findingId,
          summary: snap.findingTitle,
          route: `/hallazgos/${snap.findingId}`,
        })
      : node('finding', 'missing', {
          blockingReason: 'No hay hallazgo compuesto vinculado al evento primario.',
        }),
  )

  nodes.push(
    snap.priorityId
      ? node('priority', 'available', {
          resourceId: snap.priorityId,
          route: `/prioridades/${snap.priorityId}`,
          summary: 'Evaluación de prioridad activa',
        })
      : node('priority', 'missing', {
          blockingReason: 'Aún no existe evaluación de prioridad para la entidad vinculada.',
        }),
  )

  nodes.push(
    snap.incidentId
      ? node('incident', snap.classification === 'legacy' ? 'legacy' : snap.classification === 'demo' ? 'demo' : 'available', {
          resourceId: snap.incidentId,
          route: `/incidentes/${snap.incidentId}`,
          classification: snap.classification,
          summary:
            snap.classification === 'legacy'
              ? 'Incidente legacy — ownership pendiente'
              : snap.classification === 'demo'
                ? 'Incidente de demostración interna'
                : 'Incidente operacional',
        })
      : node('incident', 'missing', {
          blockingReason: 'Los eventos aún no se correlacionaron en un incidente.',
        }),
  )

  nodes.push(
    snap.verificationPlanId
      ? node('verification', 'available', {
          resourceId: snap.verificationPlanId,
          route: `/incidentes/${snap.incidentId}#verificacion`,
          summary: snap.verificationSummary ?? 'Plan de verificación activo',
        })
      : snap.incidentId
        ? node('verification', 'missing', {
            blockingReason: 'No existen preguntas activas de verificación para este incidente.',
          })
        : node('verification', 'missing', {
            blockingReason: 'Requiere un incidente correlacionado.',
          }),
  )

  nodes.push(
    snap.missionId
      ? node('mission', isInternalDemoMissionTitle(snap.missionTitle ?? '') ? 'demo' : 'available', {
          resourceId: snap.missionId,
          route: `/misiones/${snap.missionId}`,
          summary: snap.missionTitle,
          classification: isInternalDemoMissionTitle(snap.missionTitle ?? '') ? 'demo' : 'operational',
        })
      : snap.verificationPlanId
        ? node('mission', 'not_required', {
            blockingReason:
              'No se recomienda una misión porque la revisión remota es suficiente para esta pregunta.',
          })
        : node('mission', 'missing', {
            blockingReason: 'Sin misión activa vinculada.',
          }),
  )

  nodes.push(
    snap.evidenceId
      ? node('evidence', snap.evidenceStatus === 'validated' ? 'available' : 'pending', {
          resourceId: snap.evidenceId,
          route: `/misiones/${snap.missionId ?? ''}#evidencia`,
          summary: snap.evidenceStatus,
        })
      : snap.missionId
        ? node('evidence', 'pending', {
            blockingReason: 'La misión existe pero aún no hay evidencia recibida.',
          })
        : node('evidence', 'missing', {
            blockingReason: 'Sin envíos de evidencia en el ciclo.',
          }),
  )

  nodes.push(
    snap.hasResolution
      ? node('resolution', 'available', {
          route: `/incidentes/${snap.incidentId}#resolucion`,
          summary: snap.resolutionSummary,
        })
      : node('resolution', 'missing', {
          blockingReason: 'Aún no existe una resolución. Se generará después de validar evidencia suficiente.',
        }),
  )

  nodes.push(
    snap.hasResponse
      ? node('response', 'available', {
          resourceId: snap.incidentId,
          route: `/respuesta/${snap.incidentId}`,
          summary: snap.responseSummary,
        })
      : node('response', 'missing', {
          blockingReason: 'Aún no existe una evaluación de respuesta.',
        }),
  )

  nodes.push(
    snap.incidentId
      ? node('report', 'available', {
          route: `/informes/incidentes/${snap.incidentId}`,
          summary: 'Informe por incidente',
        })
      : node('report', 'missing', {
          blockingReason: 'Requiere un incidente para generar informe.',
        }),
  )

  return nodes.map((n) =>
    n.stage === current ? { ...n, status: n.status === 'missing' ? 'missing' : n.status } : n,
  )
}

async function resolveIncidentChain(incidentId: string): Promise<ChainSnapshot | null> {
  const incident = await getIncidentById(incidentId)
  if (!incident) return null

  const classification = classifyIncident(incident)
  const detail = incident as { primary_event_id?: string | null }
  const primaryEventId = detail.primary_event_id ? String(detail.primary_event_id) : undefined

  let findingId: string | undefined
  let findingTitle: string | undefined
  if (primaryEventId) {
    const findings = await listCompositeFindings({
      entity_type: 'fire_event',
      entity_id: primaryEventId,
      limit: 1,
    })
    if (findings[0]) {
      findingId = findings[0].id
      findingTitle = findings[0].title
    }
  }

  let priorityId: string | undefined
  if (primaryEventId) {
    const pr = await getActivePriorityAssessment(
      'fire_event',
      primaryEventId,
      resolvePriorityModelVersion(),
    )
    if (pr) priorityId = pr.id
  }

  const plan = await getActiveVerificationPlan(incidentId, FIRE_VERIFICATION_MODEL_VERSION)
  let verificationSummary: string | undefined
  if (plan) {
    verificationSummary = `Plan ${plan.status}`
  }

  const missions = await listMissions({ incident_id: incidentId, limit: 5 })
  const mission = missions.find((m) => !isInternalDemoMissionTitle(String(m.title))) ?? missions[0]
  const missionId = mission?.id
  const missionTitle = mission ? String(mission.title) : undefined

  const evidenceRows = await listEvidenceSubmissionsByIncident(incidentId)
  const evidence = evidenceRows[0]
  const evidenceId = evidence?.id
  const evidenceStatus = evidence ? String(evidence.status) : undefined

  const resolution = await getIncidentVerificationResolution(incidentId)
  const resolutions = (resolution?.needs as Array<{ resolution?: unknown }> | undefined) ?? []
  const hasResolution = resolutions.some((n) => n.resolution != null)
  const resolutionSummary = hasResolution ? 'Resolución registrada' : undefined

  const assessment = incident.organization_id
    ? await getActiveAssessmentForIncident(incidentId, String(incident.organization_id))
    : null
  const hasResponse = Boolean(assessment)
  const responseSummary = assessment
    ? `Nivel recomendado: ${String(assessment.recommended_response_level)}`
    : undefined

  return {
    classification,
    incidentId,
    primaryEventId,
    findingId,
    findingTitle,
    priorityId,
    verificationPlanId: plan?.id,
    verificationSummary,
    missionId,
    missionTitle,
    evidenceId,
    evidenceStatus,
    hasResolution,
    resolutionSummary,
    hasResponse,
    responseSummary,
  }
}

async function resolveFromFinding(findingId: string): Promise<ChainSnapshot | null> {
  const finding = await getCompositeFindingById(findingId)
  if (!finding) return null

  let snap: ChainSnapshot | null = null
  if (finding.entity_type === 'fire_event') {
    const inc = await getIncidentForFireEvent(finding.entity_id)
    if (inc) {
      snap = await resolveIncidentChain(inc.id)
    } else {
      const pr = await getActivePriorityAssessment(
        'fire_event',
        finding.entity_id,
        resolvePriorityModelVersion(),
      )
      snap = {
        classification: 'operational',
        primaryEventId: finding.entity_id,
        findingId: finding.id,
        findingTitle: finding.title,
        priorityId: pr?.id,
        hasResolution: false,
        hasResponse: false,
      }
    }
  }

  if (!snap) {
    snap = {
      classification: 'operational',
      findingId: finding.id,
      findingTitle: finding.title,
      hasResolution: false,
      hasResponse: false,
    }
  } else {
    snap.findingId = finding.id
    snap.findingTitle = finding.title
  }
  return snap
}

async function resolveFromPriority(priorityId: string): Promise<ChainSnapshot | null> {
  const row = await getPriorityAssessmentById(priorityId)
  if (!row) return null

  let snap: ChainSnapshot | null = null
  if (row.entity_type === 'fire_event') {
    const inc = await getIncidentForFireEvent(row.entity_id)
    if (inc) snap = await resolveIncidentChain(inc.id)
    else {
      snap = {
        classification: 'operational',
        primaryEventId: row.entity_id,
        priorityId: row.id,
        hasResolution: false,
        hasResponse: false,
      }
    }
  } else {
    snap = {
      classification: 'operational',
      priorityId: row.id,
      hasResolution: false,
      hasResponse: false,
    }
  }
  if (snap) snap.priorityId = row.id
  return snap
}

async function resolveFromMission(missionId: string): Promise<ChainSnapshot | null> {
  const mission = await getMissionById(missionId)
  if (!mission) return null
  const snap = await resolveIncidentChain(String(mission.incident_id))
  if (!snap) return null
  snap.missionId = mission.id
  snap.missionTitle = String(mission.title)
  return snap
}

async function resolveFromEvidence(evidenceId: string): Promise<ChainSnapshot | null> {
  const submission = await getEvidenceSubmissionById(evidenceId)
  if (!submission) return null
  const snap = await resolveIncidentChain(String(submission.incident_id))
  if (!snap) return null
  snap.evidenceId = submission.id
  snap.evidenceStatus = String(submission.status)
  snap.missionId = String(submission.mission_id)
  return snap
}

function stageForResource(type: IntelligenceFlowResourceType): IntelligenceFlowStage {
  const map: Record<IntelligenceFlowResourceType, IntelligenceFlowStage> = {
    finding: 'finding',
    priority: 'priority',
    incident: 'incident',
    mission: 'mission',
    evidence: 'evidence',
    response: 'response',
  }
  return map[type]
}

export async function getIntelligenceFlow(
  resourceType: IntelligenceFlowResourceType,
  resourceId: string,
  _auth: RequestAuthContext,
): Promise<IntelligenceFlowDto | null> {
  let snap: ChainSnapshot | null = null

  switch (resourceType) {
    case 'finding':
      snap = await resolveFromFinding(resourceId)
      break
    case 'priority':
      snap = await resolveFromPriority(resourceId)
      break
    case 'incident':
    case 'response':
      snap = await resolveIncidentChain(resourceId)
      break
    case 'mission':
      snap = await resolveFromMission(resourceId)
      break
    case 'evidence':
      snap = await resolveFromEvidence(resourceId)
      break
    default:
      return null
  }

  if (!snap) return null

  const currentStage = stageForResource(resourceType)
  return {
    resource_type: resourceType,
    resource_id: resourceId,
    current_stage: currentStage,
    classification: snap.classification,
    nodes: buildNodes(snap, currentStage),
    generated_at: new Date().toISOString(),
  }
}
