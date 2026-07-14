import { useState } from 'react'
import type { NewsEvidenceDto } from '../types/news-analysis-dto.types'

export function EvidenceModal({
  evidence,
  onClose,
}: {
  evidence: NewsEvidenceDto[]
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border-subtle bg-surface-1 p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">Evidencia</h3>
          <button type="button" onClick={onClose} className="text-xs text-text-tertiary hover:text-text-secondary">
            Cerrar
          </button>
        </div>
        <ul className="mt-3 space-y-3">
          {evidence.map((ev, i) => (
            <li key={i} className="rounded-lg border border-border-subtle bg-surface-2/50 p-3 text-sm">
              <p className="text-[11px] font-medium text-text-tertiary">{ev.field_label}</p>
              <p className="mt-1 text-text-primary">{ev.excerpt}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function EvidenceButton({ evidence }: { evidence: NewsEvidenceDto[] }) {
  const [open, setOpen] = useState(false)
  if (evidence.length === 0) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-sky-400 hover:text-sky-300"
      >
        Ver evidencia
      </button>
      {open && <EvidenceModal evidence={evidence} onClose={() => setOpen(false)} />}
    </>
  )
}
