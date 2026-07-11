import { missionTypeLabel } from './mission-labels'
import { findInternalPhaseCodes } from '@/shared/product-language'

export type MissionClassification = 'operational' | 'demo'

/** Persistent banners for demo missions. */
export const MISSION_DEMO_BANNER = 'DEMOSTRACIÓN INTERNA · NO OPERACIONAL'
export const MISSION_DEMO_READONLY_BANNER = 'DEMOSTRACIÓN INTERNA · SOLO LECTURA'

/** Generic, safe copy used to replace internal pilot language on demo missions. */
export const MISSION_DEMO_OBJECTIVE =
  'Validar el flujo de captura y sincronización de evidencia de campo. Esta misión no representa una emergencia ni una confirmación ambiental.'
export const MISSION_DEMO_LOCATION = 'Sitio interno de demostración'
export const MISSION_DEMO_RESPONSIBLE = 'Responsable de demostración'
export const MISSION_DEMO_ACTIONS_DISABLED =
  'Esta misión es una demostración interna. Las acciones operacionales reales están deshabilitadas.'
export const MISSION_DEMO_PACKAGE_UNAVAILABLE =
  'Paquete offline no disponible para misiones de demostración.'

/** True when the resource is an internal demo/pilot mission. */
export function isDemoClassification(
  classification: string | null | undefined,
): classification is 'demo' {
  return classification === 'demo'
}

/**
 * Defense-in-depth list filter: demo missions are only ever visible when demo
 * mode is explicitly on. This guarantees the default `/misiones` list stays
 * operational-only even if a cached response (e.g. a previous `?demo=1` load)
 * still contains demo records.
 */
export function filterMissionsByMode<T extends { classification?: string | null }>(
  items: T[],
  showDemo: boolean,
): T[] {
  if (showDemo) return items
  return items.filter((m) => m.classification !== 'demo')
}

/** Short, stable reference for a mission (first hex block of the id). */
export function missionShortRef(id: string): string {
  const hex = id.replace(/[^a-z0-9]/gi, '')
  return hex.slice(0, 4).toUpperCase()
}

/**
 * Display title. Demo missions never expose internal pilot titles; they show the
 * translated mission type plus a short reference so records stay distinguishable.
 */
export function missionDisplayTitle(
  mission: { title?: string | null; mission_type?: string | null; id: string },
  classification: string | null | undefined,
): string {
  if (isDemoClassification(classification)) {
    const type = missionTypeLabel(String(mission.mission_type ?? 'field_verification'))
    return `${type} · Ref. ${missionShortRef(mission.id)}`
  }
  return String(mission.title ?? 'Misión sin título')
}

/** Objective, replaced with safe copy for demo missions. */
export function missionDisplayObjective(
  objective: string | null | undefined,
  classification: string | null | undefined,
): string {
  if (isDemoClassification(classification)) return MISSION_DEMO_OBJECTIVE
  return String(objective ?? 'Objetivo no especificado.')
}

/** Location, replaced with safe copy for demo missions. */
export function missionDisplayLocation(
  location: string | null | undefined,
  classification: string | null | undefined,
): string {
  if (isDemoClassification(classification)) return MISSION_DEMO_LOCATION
  const raw = String(location ?? '').trim()
  return raw.length > 0 ? raw : 'Ubicación no especificada.'
}

/**
 * Whether the expiry date adds information beyond the due date. When both are
 * identical we only show "Fecha límite" to avoid a duplicated-looking field.
 */
export function shouldShowExpiry(
  dueAt: string | null | undefined,
  expiresAt: string | null | undefined,
): boolean {
  if (!expiresAt) return false
  return expiresAt !== dueAt
}

/** Operational priority as a category label (P1, P2 …) — never a bare number. */
export function missionPriorityLabel(priority: number | string | null | undefined): string {
  const n = Number(priority)
  if (!Number.isFinite(n)) return 'Prioridad operativa: sin definir'
  return `Prioridad operativa: P${n}`
}

/**
 * Sanitize a stored free-text reason/note for display.
 *
 * Demo missions get a fixed generic label. For operational records we strip
 * internal phase codes so DB fixtures never leak raw tokens into the UI.
 */
export function sanitizeMissionReason(
  reason: string | null | undefined,
  classification: string | null | undefined,
): string | null {
  if (isDemoClassification(classification)) return 'Asignación de demostración'
  const raw = String(reason ?? '').trim()
  if (!raw) return null
  if (findInternalPhaseCodes(raw).length > 0) return null
  // Drop reasons that are clearly internal pilot/English fixtures.
  if (/\bpilot\b|field sync|internal only|allowlist/i.test(raw)) return null
  return raw
}
