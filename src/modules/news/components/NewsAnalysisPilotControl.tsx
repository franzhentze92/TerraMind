import { useState } from 'react'
import { useHasPermission } from '@/core/auth/AuthProvider'
import { useBatchAnalyze, useBatchAnalyzeDryRun } from '../hooks/useNewsAnalysis'

/** Control de piloto — estimación de costo y ejecución batch controlada. */
export function NewsAnalysisPilotControl({
  documentIds,
  limit = 5,
}: {
  documentIds?: string[]
  limit?: number
}) {
  const canRun = useHasPermission('news.analysis.run')
  const dryRun = useBatchAnalyzeDryRun()
  const batch = useBatchAnalyze()
  const [confirmed, setConfirmed] = useState(false)

  if (!canRun) return null

  const estimate = dryRun.data

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-2/40 p-4 text-sm" data-testid="news-pilot-control">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Piloto de análisis</h3>
      <p className="mt-1 text-text-secondary">
        Máximo {limit} noticias · modelo rápido por defecto · confirmación de costo requerida.
      </p>

      <button
        type="button"
        disabled={dryRun.isPending}
        onClick={() =>
          dryRun.mutate({ documentIds, limit, modelTier: 'fast' })
        }
        className="mt-2 rounded-lg border border-border-subtle px-3 py-1.5 text-xs hover:bg-surface-1"
      >
        Estimar costo del lote
      </button>

      {estimate && (
        <div className="mt-3 space-y-1 text-xs text-text-secondary">
          <p>Elegibles: {estimate.eligible_documents.length}</p>
          <p>Ya analizados: {estimate.already_analyzed.length}</p>
          <p>
            Tokens estimados: {estimate.estimated_input_tokens} entrada / {estimate.estimated_output_tokens} salida
          </p>
          <p className="font-medium text-text-primary">
            Costo estimado: USD {estimate.estimated_cost_usd.toFixed(4)} ({estimate.model_name})
          </p>
          {estimate.warnings.map((w, i) => (
            <p key={i} className="text-amber-300">{w}</p>
          ))}
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            Confirmo ejecutar el análisis con el costo estimado
          </label>
          <button
            type="button"
            disabled={!confirmed || batch.isPending || estimate.eligible_documents.length === 0}
            onClick={() =>
              batch.mutate({
                documentIds,
                limit,
                modelTier: 'fast',
                estimatedCostConfirmation: true,
              })
            }
            className="mt-2 rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {batch.isPending ? 'Procesando lote…' : 'Ejecutar piloto'}
          </button>
        </div>
      )}

      {batch.data && !batch.data.dry_run && (
        <p className="mt-2 text-xs text-text-secondary">
          Procesados: {batch.data.processed} · Fallidos: {batch.data.failed}
          {batch.data.total_actual_cost_usd != null && (
            <> · Costo real: USD {batch.data.total_actual_cost_usd.toFixed(4)}</>
          )}
        </p>
      )}
    </div>
  )
}
