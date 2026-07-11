import { useState } from 'react'

import { Badge } from '@/shared/components/Badge'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import {
  useDownloadOfflinePackage,
  useGenerateOfflinePackage,
  useMissionOfflinePackages,
  useRevokeOfflinePackage,
  useValidateOfflinePackageIntegrity,
} from '@/modules/field-operations/offline-packages/hooks/useOfflinePackages'

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    queued: 'En cola',
    generating: 'Generando',
    ready: 'Listo',
    downloaded: 'Descargado',
    superseded: 'Reemplazado',
    revoked: 'Revocado',
    expired: 'Expirado',
    generation_failed: 'Fallo de generación',
  }
  return map[status] ?? status
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function OfflinePackageSection({
  missionId,
  missionTitle,
  missionStatus,
}: {
  missionId: string
  missionTitle: string
  missionStatus: string
}) {
  const packagesQuery = useMissionOfflinePackages(missionId)
  const generateMutation = useGenerateOfflinePackage(missionId)
  const downloadMutation = useDownloadOfflinePackage(missionId, missionTitle)
  const revokeMutation = useRevokeOfflinePackage(missionId)
  const validateMutation = useValidateOfflinePackageIntegrity()
  const [revokeReason, setRevokeReason] = useState('')

  const items = packagesQuery.data?.items ?? []
  const active = items[0]

  const canGenerate = ['ready', 'approved', 'assigned', 'in_progress'].includes(missionStatus)

  return (
    <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Paquete offline</h2>
          <p className="text-xs text-text-tertiary">
            Snapshot versionado para ejecución en campo sin conexión.
          </p>
        </div>
        <button
          type="button"
          disabled={!canGenerate || generateMutation.isPending}
          onClick={() =>
            generateMutation.mutate({ idempotency_key: crypto.randomUUID() })
          }
          className="rounded border border-accent/40 px-3 py-1.5 text-xs text-accent disabled:opacity-40"
        >
          {generateMutation.isPending ? 'Solicitando…' : 'Generar paquete'}
        </button>
      </div>

      {generateMutation.data && (
        <p className="mb-2 text-xs text-text-secondary">
          Decisión: {generateMutation.data.decision}
          {generateMutation.data.reasons.length > 0 &&
            ` — ${generateMutation.data.reasons.join(', ')}`}
        </p>
      )}

      {packagesQuery.isLoading && (
        <p className="text-xs text-text-tertiary">Cargando paquetes…</p>
      )}

      {!packagesQuery.isLoading && items.length === 0 && (
        <p className="text-xs text-text-tertiary">Sin paquetes generados.</p>
      )}

      {active && (
        <div className="rounded border border-border-subtle/60 bg-surface-1/40 p-3 text-xs">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant="default">v{String(active.package_version)}</Badge>
            <Badge variant="default">{statusLabel(String(active.status))}</Badge>
            {active.size_bytes ? (
              <Badge variant="default">{formatBytes(Number(active.size_bytes))}</Badge>
            ) : null}
          </div>
          <p className="text-text-secondary">
            Vigencia: {formatGuatemalaDateTime(String(active.valid_from))} →{' '}
            {formatGuatemalaDateTime(String(active.valid_until))}
          </p>
          {Boolean(active.generated_at) && (
            <p className="mt-1 text-text-tertiary">
              Generado: {formatGuatemalaDateTime(String(active.generated_at))}
            </p>
          )}
          {Boolean(active.supersedes_package_id) && (
            <p className="mt-1 text-text-tertiary">
              Reemplaza: {String(active.supersedes_package_id).slice(0, 8)}…
            </p>
          )}
          {Boolean(active.revocation_reason) && (
            <p className="mt-1 text-confidence-low">
              Revocación: {String(active.revocation_reason)}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {active.status === 'ready' && (
              <button
                type="button"
                disabled={downloadMutation.isPending}
                onClick={() => downloadMutation.mutate(String(active.id))}
                className="rounded border border-border-subtle px-2 py-1 text-text-secondary hover:text-text-primary"
              >
                {downloadMutation.isPending ? 'Descargando…' : 'Descargar'}
              </button>
            )}
            <button
              type="button"
              disabled={validateMutation.isPending}
              onClick={() => validateMutation.mutate(String(active.id))}
              className="rounded border border-border-subtle px-2 py-1 text-text-secondary hover:text-text-primary"
            >
              Validar integridad
            </button>
          </div>
          {validateMutation.data && (
            <p className={`mt-2 ${validateMutation.data.valid ? 'text-confidence-high' : 'text-confidence-low'}`}>
              Integridad: {validateMutation.data.valid ? 'válida' : validateMutation.data.errors.join(', ')}
            </p>
          )}
          {downloadMutation.isSuccess && (
            <p className="mt-2 text-confidence-high">
              Paquete guardado localmente ({downloadMutation.data.local_status}).
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              placeholder="Razón de revocación"
              className="min-w-[200px] flex-1 rounded border border-border-subtle bg-surface-1 px-2 py-1 text-xs"
            />
            <button
              type="button"
              disabled={!revokeReason.trim() || revokeMutation.isPending}
              onClick={() =>
                revokeMutation.mutate({
                  packageId: String(active.id),
                  reason: revokeReason.trim(),
                })
              }
              className="rounded border border-confidence-low/40 px-2 py-1 text-confidence-low"
            >
              Revocar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
