import type { FireDataStatusDto, FirePipelineHealthDto } from '@/modules/fires/types/fire.dto'
import { resolveThermalDataStatus } from '@/modules/fires/utils/thermal-data-status'
import { Badge } from '@/shared/components/Badge'

interface ThermalDataStatusLineProps {
  dataStatus?: FireDataStatusDto
  pipelineHealth?: FirePipelineHealthDto
  isLoading?: boolean
}

export function ThermalDataStatusLine({
  dataStatus,
  pipelineHealth,
  isLoading,
}: ThermalDataStatusLineProps) {
  if (isLoading) {
    return <span className="text-xs text-text-tertiary">Verificando estado de datos…</span>
  }

  if (!dataStatus && !pipelineHealth) return null

  if (pipelineHealth && !pipelineHealth.enabled) {
    return (
      <span className="text-xs text-text-tertiary">
        Actualización automática deshabilitada
      </span>
    )
  }

  const status = resolveThermalDataStatus({ dataStatus, pipelineHealth })

  return (
    <div
      className="flex flex-col gap-1.5 text-xs"
      data-thermal-data-state={status.state}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status.variant}>{status.label}</Badge>
        <span className="text-text-tertiary">{status.explanation}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-text-tertiary">
        <span>{status.firmsProvidersLine}</span>
        {status.lastUpdateLine && <span>{status.lastUpdateLine}</span>}
        {status.nextUpdateLine && <span>{status.nextUpdateLine}</span>}
      </div>
    </div>
  )
}
