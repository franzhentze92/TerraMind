import { useRef, useState } from 'react'

import { useOfflineEvidenceTask } from '@/modules/field-operations/offline-evidence/hooks/useOfflineEvidence'
import type { LocalOfflinePackageRecord } from '@/modules/field-operations/offline-packages/offline-package.repository'
import { evidenceTypeLabel, humanizeToken } from '@/shared/product-language'

function formatCoverageLine(c: {
  evidence_type: string
  minimum_count: number
  captured_count: number
  missing_count: number
  warnings: string[]
}): string {
  const base = `${evidenceTypeLabel(c.evidence_type)}: ${c.minimum_count} mínimo · ${c.captured_count} capturada(s)`
  if (c.missing_count > 0) return `${base} · ${c.missing_count} faltantes`
  if (c.warnings.length) return `${base} · ${c.warnings.join(', ')}`
  return base
}

export function LocalEvidencePanel({
  pkg,
  taskId,
}: {
  pkg: LocalOfflinePackageRecord
  taskId: string
}) {
  const evidence = useOfflineEvidenceTask(pkg, taskId)
  const photoInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const blocked = ['revoked', 'superseded', 'integrity_failed'].includes(pkg.local_status)

  return (
    <section className="mt-8 border-t border-border-subtle pt-6">
      <h2 className="mb-1 text-base font-medium text-text-primary">Evidencia local</h2>
      <p className="mb-4 text-xs text-text-tertiary">
        Captura offline vinculada a la tarea. Los registros locales no son envíos al servidor.
      </p>

      {blocked && (
        <p className="mb-3 rounded border border-confidence-medium/30 bg-surface-2/40 p-2 text-xs text-confidence-medium">
          Paquete {pkg.local_status}: no se permiten nuevas capturas. La evidencia ya guardada se conserva.
        </p>
      )}

      {evidence.storageWarning && (
        <p className="mb-3 rounded border border-confidence-medium/30 p-2 text-xs text-confidence-medium">
          Poco espacio de almacenamiento local. No se eliminará evidencia pendiente de sincronización.
        </p>
      )}

      <div className="mb-4 space-y-2">
        {evidence.coverage.map((c) => (
          <div
            key={c.requirement_id}
            className="rounded border border-border-subtle bg-surface-2/20 px-3 py-2 text-xs text-text-secondary"
          >
            {formatCoverageLine(c)}
            <span className="ml-2 text-text-tertiary">· cobertura preliminar: {c.coverage_status}</span>
          </div>
        ))}
        {evidence.coverage.length === 0 && (
          <p className="text-xs text-text-tertiary">Sin requisitos de evidencia embebidos en el paquete.</p>
        )}
      </div>

      {!blocked && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border border-border-subtle px-3 py-2 text-sm"
            onClick={() => photoInput.current?.click()}
          >
            Tomar / seleccionar foto
          </button>
          <input
            ref={photoInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              void evidence.capturePhoto(file).then((r) => {
                setMessage(r.ok ? 'Foto guardada localmente.' : (r.reason ?? 'Error al capturar'))
              })
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="rounded border border-border-subtle px-3 py-2 text-sm"
            onClick={() => videoInput.current?.click()}
          >
            Seleccionar video
          </button>
          <input
            ref={videoInput}
            type="file"
            accept="video/mp4,video/webm"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const video = document.createElement('video')
              video.preload = 'metadata'
              video.onloadedmetadata = () => {
                void evidence.captureVideo(file, video.duration || 0).then((r) => {
                  setMessage(r.ok ? 'Video guardado localmente.' : (r.reason ?? 'Error al capturar'))
                })
              }
              video.src = URL.createObjectURL(file)
              e.target.value = ''
            }}
          />
        </div>
      )}

      {!blocked && (
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota con marca de tiempo"
            className="flex-1 rounded border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="rounded border border-border-subtle px-3 py-2 text-sm"
            onClick={() => {
              void evidence.addNote(note).then((r) => {
                if (r.ok) {
                  setNote('')
                  setMessage('Nota guardada.')
                } else setMessage(r.reason ?? 'Error')
              })
            }}
          >
            Agregar nota
          </button>
        </div>
      )}

      {message && <p className="mb-3 text-xs text-text-secondary">{message}</p>}

      <ul className="mb-4 space-y-2">
        {evidence.records
          .filter((r) => r.status !== 'deleted_pending_sync')
          .map((r) => (
            <li
              key={r.local_evidence_id}
              className="flex items-start justify-between gap-2 rounded border border-border-subtle px-3 py-2 text-xs"
            >
              <div>
                <p className="font-medium text-text-primary">{evidenceTypeLabel(r.evidence_type)}</p>
                <p className="text-text-tertiary">
                  {new Date(r.captured_at).toLocaleString()} · {humanizeToken(r.status)}
                </p>
                {r.limitations.length > 0 && (
                  <p className="text-confidence-medium">Limitaciones: {r.limitations.join(', ')}</p>
                )}
              </div>
              {r.status !== 'pending_sync' && !blocked && (
                <button
                  type="button"
                  className="text-confidence-low hover:underline"
                  onClick={() => void evidence.removeEvidence(r.local_evidence_id)}
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
      </ul>

      {evidence.bundle && (
        <div className="mb-4 rounded border border-accent/30 bg-surface-2/30 p-3 text-xs">
          <p className="font-medium text-text-primary">Bundle local</p>
          <p className="text-text-secondary">Estado: {evidence.bundle.status}</p>
          <p className="text-text-tertiary">Checksum: {evidence.bundle.bundle_checksum.slice(0, 16)}…</p>
          <p className="text-text-tertiary">Tamaño: {(evidence.bundle.size_bytes / 1024).toFixed(1)} KB</p>
        </div>
      )}

      {!blocked && (
        <button
          type="button"
          className="rounded border border-accent/40 px-4 py-2 text-sm text-accent"
          onClick={() => {
            void evidence.prepareBundle(true).then((r) => {
              if (!r) return
              setMessage(
                r.bundle.status === 'pending_sync'
                  ? 'Bundle preparado — pendiente de sincronización (sin upload en esta fase).'
                  : `Bundle: ${r.bundle.status}. Revise cobertura preliminar.`,
              )
            })
          }}
        >
          Preparar para sincronizar
        </button>
      )}
    </section>
  )
}
