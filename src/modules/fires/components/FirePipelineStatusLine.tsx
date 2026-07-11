import type { FirePipelineHealthDto } from '@/modules/fires/types/fire.dto'
import { resolveThermalDataStatus } from '@/modules/fires/utils/thermal-data-status'
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

function mapThermalState(
  state: ReturnType<typeof resolveThermalDataStatus>['state'],
): PipelineState {
  switch (state) {
    case 'current':
    case 'partial':
      return 'operational'
    case 'delayed':
    case 'no_recent_data':
      return 'delayed'
    case 'failing':
      return 'failing'
    default:
      return 'delayed'
  }
}

/** Legacy wrapper — prefer resolveThermalDataStatus + ThermalDataStatusLine. */
export function resolveFirePipelineStatus(health: FirePipelineHealthDto): PipelinePresentation {
  const status = resolveThermalDataStatus({ pipelineHealth: health })
  return {
    state: mapThermalState(status.state),
    label: status.label,
    variant: status.variant === 'default' ? 'accent' : status.variant,
    explanation: status.explanation,
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
