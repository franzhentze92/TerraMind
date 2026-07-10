import type { FireEventDetectionDto } from '@/modules/fires/types/fire.dto'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { confidenceLabel } from '@/modules/fires/utils/fire-interpretation'
import {
  satelliteDisplayName,
  sourceProductDisplayName,
} from '@/modules/fires/utils/source-labels'

interface FireEvidenceTimelineProps {
  detections: FireEventDetectionDto[]
}

export function FireEvidenceTimeline({ detections }: FireEvidenceTimelineProps) {
  if (detections.length === 0) {
    return <p className="text-sm text-text-secondary">Sin detecciones vinculadas.</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <table className="w-full min-w-[640px] text-left text-xs" aria-label="Evidencia satelital">
        <thead className="border-b border-border-subtle bg-surface-2/80 text-[10px] uppercase tracking-wider text-text-tertiary">
          <tr>
            <th className="px-3 py-2">Hora</th>
            <th className="px-3 py-2">Fuente</th>
            <th className="px-3 py-2">Satélite</th>
            <th className="px-3 py-2">Confianza</th>
            <th className="px-3 py-2">FRP</th>
            <th className="px-3 py-2">D/N</th>
          </tr>
        </thead>
        <tbody>
          {detections.map((d) => (
            <tr key={d.id} className="border-b border-border-subtle last:border-0">
              <td className="px-3 py-2 font-mono text-text-secondary">
                {formatGuatemalaDateTime(d.acquired_at_utc)}
              </td>
              <td className="px-3 py-2 text-text-primary" title={d.source_product}>
                {sourceProductDisplayName(d.source_product)}
              </td>
              <td className="px-3 py-2 text-text-secondary" title={d.satellite ?? undefined}>
                {satelliteDisplayName(d.satellite)}
              </td>
              <td className="px-3 py-2 text-text-secondary">
                {confidenceLabel(d.confidence_normalized)}
              </td>
              <td className="px-3 py-2 font-mono text-text-secondary">
                {d.frp_mw != null ? `${d.frp_mw.toFixed(2)} MW` : '—'}
              </td>
              <td className="px-3 py-2 text-text-tertiary">{d.daynight ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
