import {
  METHOD_REQUIRED_CAPABILITIES,
  MISSION_TYPE_REQUIRED_CAPABILITIES,
} from '@/modules/missions/config/fire-assignment.config'
import type {
  CompatibilityResult,
  OperationalAssignee,
} from '@/modules/missions/assignment/assignment.types'

export function evaluateAssigneeCompatibility(input: {
  assignee: OperationalAssignee
  mission_type: string
  recommended_method_code: string
  active_mission_count: number
  mission_expired: boolean
}): CompatibilityResult {
  const reasons: string[] = []
  const limitations: string[] = []
  const missing: string[] = []

  if (!input.assignee.is_active) {
    return {
      compatible: false,
      score: 0,
      reasons: ['Ejecutor inactivo'],
      limitations: [],
      missing_capabilities: [],
    }
  }
  if (!input.assignee.is_available) {
    return {
      compatible: false,
      score: 0,
      reasons: ['Ejecutor no disponible'],
      limitations: [],
      missing_capabilities: [],
    }
  }
  if (input.mission_expired) {
    return {
      compatible: false,
      score: 0,
      reasons: ['Misión expirada'],
      limitations: [],
      missing_capabilities: [],
    }
  }
  if (input.active_mission_count >= input.assignee.max_active_missions) {
    return {
      compatible: false,
      score: 0,
      reasons: ['Capacidad máxima de misiones activas alcanzada'],
      limitations: [`Máximo ${input.assignee.max_active_missions} misiones activas`],
      missing_capabilities: [],
    }
  }

  const typeCaps = MISSION_TYPE_REQUIRED_CAPABILITIES[input.mission_type] ?? []
  const methodCaps = METHOD_REQUIRED_CAPABILITIES[input.recommended_method_code] ?? []
  const required = [...new Set([...typeCaps, ...methodCaps])]

  for (const cap of required) {
    if (!input.assignee.capabilities.includes(cap)) missing.push(cap)
  }

  if (
    input.assignee.allowed_mission_types.length > 0 &&
    !input.assignee.allowed_mission_types.includes(input.mission_type)
  ) {
    limitations.push(`Tipo de misión ${input.mission_type} no permitido para el ejecutor`)
  }

  const typeAllowed =
    input.assignee.allowed_mission_types.length === 0 ||
    input.assignee.allowed_mission_types.includes(input.mission_type)
  const compatible = missing.length === 0 && typeAllowed

  if (compatible) reasons.push('Ejecutor compatible con método y tipo de misión')
  if (missing.length > 0) reasons.push(`Capacidades faltantes: ${missing.join(', ')}`)

  const score = compatible
    ? 1 - input.active_mission_count / Math.max(input.assignee.max_active_missions, 1)
    : 0

  return { compatible, score, reasons, limitations, missing_capabilities: missing }
}
