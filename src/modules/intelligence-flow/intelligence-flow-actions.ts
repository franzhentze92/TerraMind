import type {
  IntelligenceFlowAction,
  IntelligenceFlowDto,
  IntelligenceFlowNode,
} from '../intelligence-flow.types'
import type { TerramindPermission } from '@/core/auth/permissions'

const STAGE_PERMISSION: Partial<Record<IntelligenceFlowNode['stage'], TerramindPermission>> = {
  finding: 'findings.view',
  priority: 'priorities.view',
  incident: 'incidents.view',
  verification: 'verification_plans.view',
  mission: 'missions.view',
  response: 'responses.view',
  report: 'findings.view',
  evidence: 'evidence.view',
}

export function buildIntelligenceFlowActions(
  flow: IntelligenceFlowDto | undefined,
  permissions: Set<TerramindPermission>,
  isPlatformAdmin = false,
): IntelligenceFlowAction[] {
  if (!flow) return []

  const actions: IntelligenceFlowAction[] = []
  const node = (stage: IntelligenceFlowNode['stage']) =>
    flow.nodes.find((n) => n.stage === stage)

  const can = (perm?: TerramindPermission) =>
    !perm || isPlatformAdmin || permissions.has(perm)

  const addLink = (id: string, label: string, target: IntelligenceFlowNode | undefined) => {
    if (!target || target.status !== 'available' || !target.route) return
    const perm = STAGE_PERMISSION[target.stage]
    if (!can(perm)) return
    actions.push({ id, label, route: target.route })
  }

  const addContext = (id: string, label: string, target: IntelligenceFlowNode | undefined) => {
    if (!target || target.status === 'available') return
    if (target.status === 'missing' || target.status === 'pending' || target.status === 'not_required') {
      actions.push({
        id,
        label,
        explanation: target.blockingReason ?? target.summary ?? 'No disponible en esta etapa.',
      })
    }
  }

  if (flow.current_stage !== 'finding') addLink('finding', 'Ver hallazgo', node('finding'))
  if (flow.current_stage !== 'priority') addLink('priority', 'Ver prioridad', node('priority'))
  if (flow.current_stage !== 'incident') addLink('incident', 'Ver incidente', node('incident'))
  addLink('verification', 'Ver verificación', node('verification'))
  addLink('mission', 'Ver misión', node('mission'))
  addLink('evidence', 'Ver evidencia', node('evidence'))
  addLink('response', 'Ver respuesta', node('response'))
  addLink('report', 'Generar informe', node('report'))

  addContext('verification-ctx', 'Verificación', node('verification'))
  addContext('mission-ctx', 'Misión', node('mission'))
  addContext('response-ctx', 'Respuesta', node('response'))

  return actions
}
