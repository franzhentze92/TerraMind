import { ModuleHeader, EmptyState } from '@/shared/components'
import { Search } from 'lucide-react'

export function FindingsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Hallazgos"
        description="Todos los hallazgos detectados por el sistema de inteligencia territorial, ordenados por relevancia y confianza."
      />
      <EmptyState
        icon={<Search className="h-8 w-8" />}
        title="Hallazgos en preparación"
        description="Los hallazgos se poblarán automáticamente cuando el motor de inteligencia esté conectado a las fuentes de datos."
        className="flex-1"
      />
    </div>
  )
}
