import { ModuleHeader, EmptyState } from '@/shared/components'
import { Map } from 'lucide-react'

export function TerritoryPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Observación del Territorio"
        description="Monitoreo continuo del territorio a través de fuentes satelitales, climáticas e hidrológicas."
      />
      <EmptyState
        icon={<Map className="h-8 w-8" />}
        title="Módulo en preparación"
        description="La capa de observación territorial se activará cuando las fuentes de datos estén conectadas."
        className="flex-1"
      />
    </div>
  )
}
