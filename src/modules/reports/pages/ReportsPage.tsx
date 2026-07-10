import { ModuleHeader, EmptyState } from '@/shared/components'
import { FileText } from 'lucide-react'

export function ReportsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Informes Automáticos"
        description="Generación de informes ejecutivos basados en evidencia y conclusiones del Copilot."
      />
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title="Módulo en preparación"
        description="Los informes se generarán automáticamente a partir de las conclusiones del sistema de inteligencia."
        className="flex-1"
      />
    </div>
  )
}
