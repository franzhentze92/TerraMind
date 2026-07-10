import { ModuleHeader, EmptyState } from '@/shared/components'
import { TrendingUp } from 'lucide-react'

export function TrendsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Tendencias"
        description="Análisis de tendencias territoriales a mediano y largo plazo."
      />
      <EmptyState
        icon={<TrendingUp className="h-8 w-8" />}
        title="Módulo en preparación"
        description="Las tendencias se calcularán a partir de series temporales de indicadores oficiales."
        className="flex-1"
      />
    </div>
  )
}
