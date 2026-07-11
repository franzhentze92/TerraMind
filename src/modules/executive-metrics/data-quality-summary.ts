/**
 * Data quality summary presentation helpers.
 *
 * Product Consolidation — Phase 1. Compact, drawer/tooltip-friendly rendering of
 * the DataQualitySummary shown on Situación Nacional (spec §10). The type itself
 * lives in executive-metric.types.ts; this module only formats it.
 */

import type { DataQualitySummary } from '@/modules/executive-metrics/executive-metric.types'
import { formatRelative } from '@/shared/time/presentation'

export const FRESHNESS_LABELS: Record<DataQualitySummary['freshnessStatus'], string> = {
  fresh: 'Actualizado',
  delayed: 'Con retraso',
  stale: 'Desactualizado',
}

export function freshnessLabel(status: DataQualitySummary['freshnessStatus']): string {
  return FRESHNESS_LABELS[status]
}

export interface DataQualityLine {
  label: string
  value: number | string
  tone: 'operational' | 'legacy' | 'demo' | 'pending' | 'neutral'
}

/** Compact list of lines for the drawer/tooltip (spec §10 example). */
export function buildDataQualityLines(
  summary: DataQualitySummary,
  now: number = Date.now(),
): DataQualityLine[] {
  const lines: DataQualityLine[] = [
    { label: 'Operacional', value: summary.operationalRecords, tone: 'operational' },
    { label: 'Registros históricos', value: summary.legacyRecords, tone: 'legacy' },
    { label: 'Demostración', value: summary.demoRecords, tone: 'demo' },
    { label: 'Organización pendiente', value: summary.unresolvedOwnershipRecords, tone: 'pending' },
    { label: 'Pendiente de procesamiento', value: summary.pendingProcessingRecords, tone: 'pending' },
  ]
  lines.push({
    label: 'Última actualización',
    value: summary.lastSuccessfulUpdateAt
      ? formatRelative(summary.lastSuccessfulUpdateAt, now)
      : 'sin datos',
    tone: 'neutral',
  })
  return lines
}
