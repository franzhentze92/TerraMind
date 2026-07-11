import { Link } from 'react-router-dom'

import { PageHeader, OperationalEmptyState, OperationalListSkeleton, FeatureDisabledState } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { useLocalOfflinePackages } from '@/modules/field-operations/offline-packages/hooks/useOfflinePackages'
import { canOpenLocalPackage, canStartFieldExecution } from '@/modules/field-operations/offline-packages/offline-package.repository'
import { useRealSyncPilot } from '@/modules/field-operations/field-sync/hooks/useRealSyncPilot'

function localStatusLabel(status: string): string {
  const map: Record<string, string> = {
    downloading: 'Descargando',
    available: 'Disponible',
    integrity_failed: 'Integridad fallida',
    superseded: 'Reemplazado',
    revoked: 'Revocado',
    expired: 'Expirado',
    pending_deletion: 'Pendiente de eliminación',
  }
  return map[status] ?? status
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FieldPackagesPage() {
  const query = useLocalOfflinePackages()
  const pilot = useRealSyncPilot(null)
  const now = new Date().toISOString()
  const items = query.data ?? []

  if (!pilot.pilotActive && !query.isLoading && items.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="field-packages-page">
        <PageHeader
          title="Paquetes en campo"
          subtitle="Paquetes offline descargados en este dispositivo."
          breadcrumbs={[{ label: 'Campo', to: '/campo' }, { label: 'Paquetes' }]}
        />
        <FeatureDisabledState
          title="El trabajo de campo no está habilitado para esta cuenta."
          explanation="Cuando se habilite, podrás descargar paquetes con instrucciones, formularios y requisitos de evidencia."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="field-packages-page">
      <PageHeader
        title="Paquetes en campo"
        subtitle="Paquetes offline descargados en este dispositivo."
        breadcrumbs={[{ label: 'Campo', to: '/campo' }, { label: 'Paquetes' }]}
      />

      {query.isLoading && <OperationalListSkeleton rows={2} />}

      {!query.isLoading && items.length === 0 && (
        <OperationalEmptyState
          title="No hay paquetes offline descargados"
          explanation="Los paquetes contienen las instrucciones, formularios y requisitos de evidencia de una misión."
          sourceProcess="Misión asignada → descarga de paquete"
          primaryAction={{ label: 'Ver misiones asignadas', href: '/campo' }}
        />
      )}

      <div className="grid gap-3">
        {items.map((pkg) => {
          const openable = canOpenLocalPackage(pkg)
          const executable = canStartFieldExecution(pkg, now)
          void openable
          void executable
          return (
            <article
              key={pkg.package_id}
              className="rounded-lg border border-border-subtle bg-surface-2/30 p-4 text-sm"
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h2 className="font-medium text-text-primary">{pkg.mission_title}</h2>
                <Badge variant="default">v{pkg.package_version}</Badge>
                <Badge variant="default">{localStatusLabel(pkg.local_status)}</Badge>
              </div>
              <p className="text-xs text-text-tertiary">
                Misión:{' '}
                <Link to={`/misiones/${pkg.mission_id}`} className="text-accent hover:underline">
                  Ver misión
                </Link>
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Vigencia hasta: {formatGuatemalaDateTime(pkg.manifest.valid_until)}
              </p>
              <p className="text-xs text-text-tertiary">
                Descargado: {pkg.downloaded_at ? formatGuatemalaDateTime(pkg.downloaded_at) : '—'}
              </p>
              <p className="text-xs text-text-tertiary">Tamaño: {formatBytes(pkg.size_bytes)}</p>
              <p className="mt-3">
                <Link
                  to={`/campo/paquetes/${pkg.package_id}`}
                  className="text-xs text-accent hover:underline"
                >
                  Abrir paquete →
                </Link>
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
