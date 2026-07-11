import { ModuleHeader, OperationalEmptyState } from '@/shared/components'
import { sourceRegistry } from '@/sources'
import { Plug } from 'lucide-react'

export function IntegrationsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="integrations-page">
      <ModuleHeader
        title="Integraciones"
        description="Fuentes de datos y servicios externos conectados con TerraMind."
      />

      <OperationalEmptyState
        compact
        className="mt-4"
        title="No hay integraciones operacionales activas"
        explanation="Las integraciones conectan fuentes de datos y servicios externos con TerraMind. Las fuentes listadas abajo están en preparación."
        status="pending"
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sourceRegistry.map((source) => (
          <article key={source.sourceType} className="rounded-xl border border-border-subtle bg-surface-2/40 p-4">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-4">
                <Plug className="h-4 w-4 text-text-tertiary" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">{source.sourceName}</p>
                <p className="text-xs text-text-tertiary">En preparación</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
