import { ModuleHeader, Card } from '@/shared/components'
import { APP_CONFIG } from '@/core/config'
import { useTerritoryStore } from '@/core/config/territory.store'

export function SettingsPage() {
  const territory = useTerritoryStore((s) => s.territory)

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Administración"
        description="Configuración del Territory Intelligence OS."
      />

      <div className="mt-6 max-w-lg space-y-4">
        <Card padding="md">
          <h3 className="text-sm font-medium text-text-primary">Sistema</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">Plataforma</dt>
              <dd className="text-text-primary">{APP_CONFIG.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Versión</dt>
              <dd className="font-mono text-text-primary">{APP_CONFIG.version}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Arquitectura</dt>
              <dd className="text-text-primary">{APP_CONFIG.tagline}</dd>
            </div>
          </dl>
        </Card>

        <Card padding="md">
          <h3 className="text-sm font-medium text-text-primary">Territorio</h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-secondary">País</dt>
              <dd className="text-text-primary">{territory.countryName}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Código</dt>
              <dd className="font-mono text-text-primary">{territory.countryCode}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-secondary">Zona horaria</dt>
              <dd className="font-mono text-text-primary">{territory.timezone}</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
