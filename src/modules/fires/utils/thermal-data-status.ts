import type { FireDataStatusDto, FirePipelineHealthDto } from '@/modules/fires/types/fire.dto'
import { formatRelativeMinutes } from '@/modules/fires/utils/format'
import { ingestionStatusLabel, firmsProviderSummary } from '@/modules/fires/utils/thermal-labels'

export type ThermalDataStatusState =
  | 'current'
  | 'partial'
  | 'delayed'
  | 'failing'
  | 'no_recent_data'

export interface ThermalDataStatusPresentation {
  state: ThermalDataStatusState
  label: string
  variant: 'accent' | 'warning' | 'critical' | 'default'
  explanation: string
  firmsProvidersLine: string
  lastUpdateLine: string | null
  nextUpdateLine: string | null
}

function hasRecentDetections(dataStatus: FireDataStatusDto | undefined): boolean {
  if (!dataStatus) return false
  return (
    dataStatus.observations_downloaded > 0 ||
    dataStatus.sources_with_detections > 0 ||
    dataStatus.latest_satellite_acquisition_at != null
  )
}

/**
 * Single canonical data-process status for Actividad térmica.
 * Collapses ingestion freshness, FIRMS provider health and pipeline health
 * into one badge + one explanation.
 */
export function resolveThermalDataStatus(input: {
  dataStatus?: FireDataStatusDto
  pipelineHealth?: FirePipelineHealthDto
}): ThermalDataStatusPresentation {
  const { dataStatus, pipelineHealth } = input
  const intervalMinutes = pipelineHealth?.interval_minutes ?? 30
  const frequency = `La frecuencia esperada es cada ${intervalMinutes} minutos.`

  const lastSuccessAt =
    dataStatus?.last_successful_ingestion_at ?? pipelineHealth?.last_success_at ?? null
  const lastSuccessText = lastSuccessAt
    ? `La última actualización exitosa ocurrió ${formatRelativeMinutes(lastSuccessAt) ?? 'recientemente'}.`
    : 'Todavía no hay una actualización exitosa registrada.'

  const firmsProvidersLine = dataStatus
    ? firmsProviderSummary(
        dataStatus.sources_queried_successfully,
        dataStatus.sources_expected,
      )
    : 'Proveedores FIRMS: información no disponible'

  const lastUpdateLine = dataStatus?.latest_satellite_acquisition_at
    ? `Última observación satelital: ${formatRelativeMinutes(dataStatus.latest_satellite_acquisition_at) ?? '—'}.`
    : null

  const nextUpdateLine =
    pipelineHealth?.enabled && pipelineHealth.next_run_at
      ? `Próxima actualización estimada: ${formatRelativeMinutes(pipelineHealth.next_run_at) ?? '—'}.`
      : null

  const pipelineCritical = pipelineHealth?.alert_level === 'critical'
  const pipelineDelayed =
    pipelineHealth?.enabled &&
    (pipelineHealth.is_stale || !pipelineHealth.is_healthy)
  const ingestionPartial = Boolean(dataStatus?.is_partial || (dataStatus?.sources_failed ?? 0) > 0)
  const ingestionStale = Boolean(dataStatus?.is_stale)
  const noRecent = !hasRecentDetections(dataStatus)

  if (pipelineCritical || (dataStatus?.ingestion_status === 'failed' && !hasRecentDetections(dataStatus))) {
    return {
      state: 'failing',
      label: 'Proceso con fallos',
      variant: 'critical',
      explanation: `${lastSuccessText} ${pipelineHealth?.consecutive_failures ? `${pipelineHealth.consecutive_failures} fallo(s) consecutivo(s). ` : ''}${frequency}`,
      firmsProvidersLine,
      lastUpdateLine,
      nextUpdateLine,
    }
  }

  if (noRecent && !lastSuccessAt) {
    return {
      state: 'no_recent_data',
      label: 'Sin datos recientes',
      variant: 'default',
      explanation: `${lastSuccessText} No hay observaciones recientes en la ventana consultada.`,
      firmsProvidersLine,
      lastUpdateLine,
      nextUpdateLine,
    }
  }

  if (ingestionPartial) {
    const failedNames = dataStatus?.failed_source_names?.length
      ? ` Fuentes con fallo: ${dataStatus.failed_source_names.map(ingestionStatusLabel).join(', ')}.`
      : ''
    return {
      state: 'partial',
      label: 'Datos parcialmente actualizados',
      variant: 'warning',
      explanation: `${lastSuccessText}${failedNames} ${frequency}`,
      firmsProvidersLine,
      lastUpdateLine,
      nextUpdateLine,
    }
  }

  if (ingestionStale || pipelineDelayed) {
    return {
      state: 'delayed',
      label: 'Datos retrasados',
      variant: 'warning',
      explanation: `${lastSuccessText} ${frequency}`,
      firmsProvidersLine,
      lastUpdateLine,
      nextUpdateLine,
    }
  }

  return {
    state: 'current',
    label: 'Datos actualizados',
    variant: 'accent',
    explanation: `${lastSuccessText} ${frequency}`,
    firmsProvidersLine,
    lastUpdateLine,
    nextUpdateLine,
  }
}
