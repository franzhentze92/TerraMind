import type { FirePipelineHealthDto } from '@/modules/fires/types/fire.dto'
import { formatRelativeMinutes } from '@/modules/fires/utils/format'
import { Badge } from '@/shared/components/Badge'

interface FirePipelineStatusLineProps {
  health?: FirePipelineHealthDto
  isLoading?: boolean
}

export function FirePipelineStatusLine({ health, isLoading }: FirePipelineStatusLineProps) {
  if (isLoading) {
    return <span className="text-text-tertiary">Verificando pipeline…</span>
  }

  if (!health) return null

  if (!health.enabled) {
    return <span className="text-text-tertiary">Pipeline automático deshabilitado</span>
  }

  const lastSuccess = health.last_success_at
    ? formatRelativeMinutes(health.last_success_at)
    : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {health.is_healthy ? (
        <Badge variant="accent">Pipeline operativo</Badge>
      ) : health.alert_level === 'critical' ? (
        <Badge variant="critical">Pipeline con fallos</Badge>
      ) : (
        <Badge variant="warning">Pipeline en advertencia</Badge>
      )}
      <span>
        Actualización automática cada {health.interval_minutes} min
      </span>
      {lastSuccess && (
        <>
          <span className="text-text-tertiary">·</span>
          <span>Última corrida exitosa {lastSuccess}</span>
        </>
      )}
      {health.is_stale && (
        <Badge variant="warning" title="Sin corrida exitosa reciente">
          Pipeline desactualizado
        </Badge>
      )}
      {health.consecutive_failures > 0 && (
        <Badge
          variant="warning"
          title={`${health.consecutive_failures} fallo(s) consecutivo(s)`}
        >
          {health.consecutive_failures} fallo{health.consecutive_failures === 1 ? '' : 's'}
        </Badge>
      )}
    </div>
  )
}
