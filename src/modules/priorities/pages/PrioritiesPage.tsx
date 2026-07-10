import { ModuleHeader, EmptyState } from '@/shared/components'
import { AlertCircle } from 'lucide-react'

export function PrioritiesPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Prioridades"
        description="Situaciones que requieren atención ejecutiva inmediata, priorizadas por impacto y confianza."
      />
      <EmptyState
        icon={<AlertCircle className="h-8 w-8" />}
        title="Prioridades en preparación"
        description="Las prioridades se derivarán automáticamente del análisis estratégico del Centro Nacional."
        className="flex-1"
      />
    </div>
  )
}
