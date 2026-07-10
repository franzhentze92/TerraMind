import { ModuleHeader, Card, Badge } from '@/shared/components'
import { sourceRegistry } from '@/sources'
import { Plug } from 'lucide-react'

export function IntegrationsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Fuentes"
        description="Estado de las fuentes de datos públicas conectadas al sistema de inteligencia."
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sourceRegistry.map((source) => (
          <Card key={source.sourceType} padding="md">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-4">
                  <Plug className="h-4 w-4 text-text-tertiary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{source.sourceName}</p>
                  <p className="text-xs text-text-tertiary">{source.sourceType}</p>
                </div>
              </div>
              <Badge>Stub</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
