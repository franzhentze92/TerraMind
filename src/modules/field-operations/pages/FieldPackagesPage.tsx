import { Link } from 'react-router-dom'

import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { useLocalOfflinePackages } from '@/modules/field-operations/offline-packages/hooks/useOfflinePackages'
import { canOpenLocalPackage, canStartFieldExecution } from '@/modules/field-operations/offline-packages/offline-package.repository'

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
  const now = new Date().toISOString()
  const items = query.data ?? []

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader
        title="Paquetes en campo"
        description="Paquetes offline descargados en este dispositivo."
      />

      {query.isLoading && <p className="text-sm text-text-tertiary">Cargando paquetes locales…</p>}

      {!query.isLoading && items.length === 0 && (
        <p className="text-sm text-text-tertiary">
          No hay paquetes descargados. Genere y descargue un paquete desde el detalle de una misión.
        </p>
      )}

      <div className="grid gap-3">
        {items.map((pkg) => {
          const openable = canOpenLocalPackage(pkg)
          const executable = canStartFieldExecution(pkg, now)
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
                  {pkg.mission_id.slice(0, 8)}…
                </Link>
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                Vigencia hasta: {formatGuatemalaDateTime(pkg.manifest.valid_until)}
              </p>
              <p className="text-xs text-text-tertiary">
                Descargado: {pkg.downloaded_at ? formatGuatemalaDateTime(pkg.downloaded_at) : '—'}
              </p>
              <p className="text-xs text-text-tertiary">Tamaño: {formatBytes(pkg.size_bytes)}</p>
              {pkg.superseded_by && (
                <p className="text-xs text-confidence-low">
                  Reemplazado por: {pkg.superseded_by.slice(0, 8)}…
                </p>
              )}
              {pkg.integrity_errors.length > 0 && (
                <p className="mt-1 text-xs text-confidence-low">
                  Errores: {pkg.integrity_errors.join(', ')}
                </p>
              )}
              <p className="mt-2 text-xs text-text-tertiary">
                {openable
                  ? executable
                    ? 'Listo para consulta offline.'
                    : 'Solo modo histórico — vigencia expirada.'
                  : 'No abrir — integridad comprometida.'}
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
