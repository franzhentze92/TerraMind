import { ModuleHeader, EmptyState } from '@/shared/components'
import { Target } from 'lucide-react'

export function StrategiesPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Estrategias"
        description="Recomendaciones estratégicas justificadas con evidencia y nivel de confianza."
      />
      <EmptyState
        icon={<Target className="h-8 w-8" />}
        title="Módulo en preparación"
        description="Las estrategias se derivarán de las conclusiones del Copilot y los indicadores territoriales."
        className="flex-1"
      />
    </div>
  )
}
