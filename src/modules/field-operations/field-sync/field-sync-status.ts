/**
 * Canonical Field Sync presentation state machine.
 *
 * Post-Consolidation Hotfix — the field screens previously rendered several
 * connectivity/sync banners at once (e.g. "Sincronización disponible" +
 * "Conectividad limitada" + "no habilitada"). This resolves a SINGLE canonical
 * state from the underlying signals so the UI can never show contradictory
 * messages simultaneously.
 */

export type FieldSyncState =
  | 'not_enabled'
  | 'offline'
  | 'available'
  | 'running'
  | 'pending'
  | 'error'

export interface FieldSyncSignals {
  featureEnabled: boolean
  authenticated: boolean
  organizationEligible: boolean
  online: boolean
  hasPendingWork: boolean
  syncRunning: boolean
  hasError: boolean
}

export interface FieldSyncStatus {
  state: FieldSyncState
  label: string
  description: string
  /** Semantic tone for badges/cards. */
  tone: 'neutral' | 'info' | 'warning' | 'critical' | 'success'
}

const COPY: Record<FieldSyncState, { label: string; description: string; tone: FieldSyncStatus['tone'] }> = {
  not_enabled: {
    label: 'Sincronización no habilitada para esta cuenta',
    description: 'El trabajo permanecerá guardado en este dispositivo.',
    tone: 'neutral',
  },
  offline: {
    label: 'Sin conexión suficiente para sincronizar',
    description: 'El trabajo permanecerá guardado en este dispositivo hasta recuperar conexión.',
    tone: 'warning',
  },
  available: {
    label: 'Sincronización disponible',
    description: 'No hay trabajo pendiente por enviar.',
    tone: 'success',
  },
  running: {
    label: 'Sincronización en curso',
    description: 'Enviando el trabajo capturado al servidor.',
    tone: 'info',
  },
  pending: {
    label: 'Trabajo pendiente de sincronización',
    description: 'Hay evidencia capturada lista para enviarse al servidor.',
    tone: 'info',
  },
  error: {
    label: 'Error de sincronización',
    description: 'No se pudo completar la sincronización. Reintenta cuando la conexión sea estable.',
    tone: 'critical',
  },
}

/**
 * Resolve the single canonical status. Priority order guarantees mutual
 * exclusivity: feature gate → error → running → offline → pending → available.
 */
export function resolveFieldSyncStatus(signals: FieldSyncSignals): FieldSyncStatus {
  const eligible = signals.featureEnabled && signals.authenticated && signals.organizationEligible

  let state: FieldSyncState
  if (!eligible) state = 'not_enabled'
  else if (signals.hasError) state = 'error'
  else if (signals.syncRunning) state = 'running'
  else if (!signals.online) state = 'offline'
  else if (signals.hasPendingWork) state = 'pending'
  else state = 'available'

  return { state, ...COPY[state] }
}
