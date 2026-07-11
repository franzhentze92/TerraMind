import type { FirePipelineHealthDto } from '@/modules/fires/types/fire.dto'
import { formatRelativeMinutes } from '@/modules/fires/utils/format'
import { Badge } from '@/shared/components/Badge'

interface FirePipelineStatusLineProps {
  health?: FirePipelineHealthDto
  isLoading?: boolean
}

type PipelineState = 'operational' | 'delayed' | 'failing' | 'disabled'

interface PipelinePresentation {
  state: PipelineState
  label: string
  variant: 'accent' | 'warning' | 'critical'
  explanation: string
}

/**
 * Resolve a SINGLE canonical pipeline status. Previously the UI could show
 * several warning badges at once for the same underlying condition (delayed +
 * stale + consecutive failures). This collapses them into one badge and one
 * explanation.
 */
export function resolveFirePipelineStatus(health: FirePipelineHealthDto): PipelinePresentation {
  const lastSuccess = health.last_success_at ? formatRelativeMinutes(health.last_success_at) : null
  const frequency = `La frecuencia esperada es cada ${health.interval_minutes} min.`
  const lastSuccessText = lastSuccess
    ? `La última actualización exitosa ocurrió ${lastSuccess}.`
    : 'Todavía no hay una corrida exitosa registrada.'

  if (health.alert_level === 'critical') {
    return {
      state: 'failing',
      label: 'Pipeline con fallos',
      variant: 'critical',
      explanation: `${lastSuccessText} ${health.consecutive_failures > 0 ? `${health.consecutive_failures} fallo(s) consecutivo(s). ` : ''}${frequency}`,
    }
  }

  if (!health.is_healthy || health.is_stale) {
    return {
      state: 'delayed',
      label: 'Datos retrasados',
      variant: 'warning',
      explanation: `${lastSuccessText} ${frequency}`,
    }
  }

  return {
    state: 'operational',
    label: 'Pipeline operativo',
    variant: 'accent',
    explanation: `${lastSuccessText} Actualización automática cada ${health.interval_minutes} min.`,
  }
}

export function FirePipelineStatusLine({ health, isLoading }: FirePipelineStatusLineProps) {
  if (isLoading) {
    return <span className="text-text-tertiary">Verificando estado de datos…</span>
  }

  if (!health) return null

  if (!health.enabled) {
    return <span className="text-text-tertiary">Actualización automática deshabilitada</span>
  }

  const status = resolveFirePipelineStatus(health)

  return (
    <div className="flex flex-wrap items-center gap-2" data-pipeline-state={status.state}>
      <Badge variant={status.variant}>{status.label}</Badge>
      <span className="text-text-tertiary">{status.explanation}</span>
    </div>
  )
}
