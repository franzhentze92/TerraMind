import { useExecutiveMetrics } from '@/modules/executive-metrics/hooks/useExecutiveMetrics'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'

function metricValue(metrics: ExecutiveMetric[], id: string): number {
  const row = metrics.find((m) => m.id === id)
  return typeof row?.value === 'number' ? row.value : 0
}

function breakdownExcluded(
  metrics: ExecutiveMetric[],
  metricId: string,
  classification: 'demo' | 'legacy',
): number {
  const row = metrics.find((m) => m.id === metricId)
  const part = row?.breakdown?.find((b) => b.classification === classification && !b.included)
  return typeof part?.value === 'number' ? part.value : 0
}

/**
 * Canonical operational/demo/legacy counts from ExecutiveMetricsService (Phase 5 §24).
 */
export function useCanonicalOperationalCounts() {
  const query = useExecutiveMetrics({ includeDemo: true, includeLegacy: true })
  const metrics = query.data?.metrics ?? []

  const missionsOperational = metricValue(metrics, 'missions_operational')
  const missionsDemo =
    metricValue(metrics, 'missions_demo') ||
    breakdownExcluded(metrics, 'missions_operational', 'demo')
  const incidentsOperational = metricValue(metrics, 'incidents_operational')
  const incidentsLegacy =
    metricValue(metrics, 'incidents_legacy') ||
    breakdownExcluded(metrics, 'incidents_operational', 'legacy')
  const verificationPlansLegacy = metricValue(metrics, 'verification_plans_legacy')
  const evidenceOperational = metricValue(metrics, 'evidence_operational')
  const evidenceDemo =
    metricValue(metrics, 'evidence_demo') ||
    breakdownExcluded(metrics, 'evidence_operational', 'demo')
  const responseAssessments = metricValue(metrics, 'response_assessments')

  return {
    isLoading: query.isLoading,
    missionsOperational,
    missionsDemo,
    incidentsOperational,
    incidentsLegacy,
    verificationPlansLegacy,
    evidenceOperational,
    evidenceDemo,
    responseAssessments,
  }
}
