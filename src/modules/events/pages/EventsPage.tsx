import { ModuleHeader, EmptyState } from '@/shared/components'
import { AlertTriangle } from 'lucide-react'

export function EventsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Gestión de Eventos"
        description="Detección, clasificación y seguimiento de eventos territoriales críticos."
      />
      <EmptyState
        icon={<AlertTriangle className="h-8 w-8" />}
        title="Módulo en preparación"
        description="El motor de eventos procesará anomalías detectadas por las fuentes de datos."
        className="flex-1"
      />
    </div>
  )
}
