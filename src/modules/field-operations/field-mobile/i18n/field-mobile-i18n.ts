import type { FieldLocale } from '@/modules/field-operations/field-mobile/field-mobile.types'

const ES: Record<string, string> = {
  saved_on_device: 'Guardado en este dispositivo',
  missing_required_evidence: 'Falta evidencia requerida',
  ready_to_sync: 'Listo para sincronizar',
  waiting_for_connection: 'Esperando conexión',
  sync_paused: 'Sincronización pausada',
  uploading_file: 'Subiendo archivo {current} de {total}',
  confirming_integrity: 'Confirmando integridad',
  received_by_server: 'Recibido por el servidor',
  needs_review: 'Requiere revisión',
  kept_locally_for_safety: 'Conservado localmente por seguridad',
  offline: 'Sin conexión',
  online_no_api: 'Sin servidor disponible',
  session_expired: 'Sesión expirada',
  slow_network: 'Red lenta',
  sync_available: 'Sincronización disponible',
  sync_in_progress: 'Sincronización en progreso',
  continue_task: 'Continuar tarea',
  prepare_sync: 'Preparar para sincronización',
  work_local_only: 'Trabajo solo en dispositivo — no enviado aún',
  do_now: 'Qué hacer ahora',
  incomplete: 'Incompleto',
  pending_send: 'Pendiente de envío',
  blocked: 'Bloqueado',
  mission_cancelled: 'Misión cancelada remotamente',
  package_revoked: 'Paquete revocado — conservado localmente',
  package_superseded: 'Paquete reemplazado — descargue actualización',
  permission_denied: 'Permiso retirado',
  checksum_mismatch: 'Integridad no coincide',
  bundle_modified: 'Bundle modificado durante sync',
  network_interrupted: 'Red interrumpida',
  keep_local: 'Conservar localmente',
  pause: 'Pausar',
  retry: 'Reintentar',
  download_update: 'Descargar actualización',
  create_revision: 'Crear revisión',
  request_help: 'Solicitar asistencia',
  logout_warning: 'Hay evidencia pendiente de sincronización en este dispositivo.',
  cleanup_blocked: 'No se puede limpiar evidencia pendiente de sincronización.',
  low_storage: 'Poco espacio de almacenamiento local',
}

const EN: Record<string, string> = {
  saved_on_device: 'Saved on this device',
  missing_required_evidence: 'Required evidence missing',
  ready_to_sync: 'Ready to sync',
  waiting_for_connection: 'Waiting for connection',
  sync_paused: 'Sync paused',
  uploading_file: 'Uploading file {current} of {total}',
  confirming_integrity: 'Confirming integrity',
  received_by_server: 'Received by server',
  needs_review: 'Needs review',
  kept_locally_for_safety: 'Kept locally for safety',
  offline: 'Offline',
  online_no_api: 'Server unavailable',
  session_expired: 'Session expired',
  slow_network: 'Slow network',
  sync_available: 'Sync available (simulated)',
  sync_in_progress: 'Sync in progress',
  continue_task: 'Continue task',
  prepare_sync: 'Prepare for sync',
  work_local_only: 'Work on device only — not sent yet',
  do_now: 'What to do now',
  incomplete: 'Incomplete',
  pending_send: 'Pending send',
  blocked: 'Blocked',
  mission_cancelled: 'Mission cancelled remotely',
  package_revoked: 'Package revoked — kept locally',
  package_superseded: 'Package replaced — download update',
  permission_denied: 'Permission withdrawn',
  checksum_mismatch: 'Integrity mismatch',
  bundle_modified: 'Bundle modified during sync',
  network_interrupted: 'Network interrupted',
  keep_local: 'Keep locally',
  pause: 'Pause',
  retry: 'Retry',
  download_update: 'Download update',
  create_revision: 'Create revision',
  request_help: 'Request assistance',
  logout_warning: 'Pending sync evidence exists on this device.',
  cleanup_blocked: 'Cannot clean up pending sync evidence.',
  low_storage: 'Low local storage space',
}

export function t(key: string, locale: FieldLocale, vars?: Record<string, string | number>): string {
  const dict = locale === 'en' ? EN : ES
  let text = dict[key] ?? ES[key] ?? key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v))
    }
  }
  return text
}

export function labelSyncStatus(status: string, locale: FieldLocale = 'es'): string {
  const map: Record<string, string> = {
    pending_sync: t('ready_to_sync', locale),
    syncing: t('sync_in_progress', locale),
    sync_queued: t('waiting_for_connection', locale),
    partially_synced: t('needs_review', locale),
    synced: t('received_by_server', locale),
    conflict: t('needs_review', locale),
    sync_blocked: t('blocked', locale),
    retry_scheduled: t('retry', locale),
    cancelled: t('sync_paused', locale),
    draft: t('saved_on_device', locale),
    ready: t('saved_on_device', locale),
  }
  return map[status] ?? t('saved_on_device', locale)
}

export function labelConnectivity(state: string, locale: FieldLocale = 'es'): string {
  const key = ['offline', 'online_no_api', 'session_expired', 'slow_network', 'sync_available', 'sync_in_progress'].includes(state)
    ? state
    : 'offline'
  return t(key, locale)
}
