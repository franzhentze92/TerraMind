import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { filterEntriesByPeriod } from './national-situation.constants'

export interface NationalExecutiveSummary {
  what_is_happening: string
  what_changed: string
  requires_attention: string
  in_verification: string
  terramind_recommends: string
}

function metricValue(metrics: ExecutiveMetric[], id: string): number {
  return metrics.find((m) => m.id === id)?.value ?? 0
}

function legacyBreakdown(metrics: ExecutiveMetric[], id: string): number {
  const m = metrics.find((x) => x.id === id)
  return m?.breakdown.filter((b) => !b.included && b.classification === 'legacy').reduce((s, b) => s + b.value, 0) ?? 0
}

function demoBreakdown(metrics: ExecutiveMetric[], id: string): number {
  const m = metrics.find((x) => x.id === id)
  return m?.breakdown.filter((b) => !b.included && b.classification === 'demo').reduce((s, b) => s + b.value, 0) ?? 0
}

/**
 * Deterministic executive summary for Situación Nacional (Phase 3 §7).
 * Uses canonical metrics + dashboard slices — no LLM.
 */
export function buildNationalExecutiveSummary(
  metrics: ExecutiveMetric[],
  dashboard: ExecutiveDashboardDto | undefined,
  periodHours = 48,
): NationalExecutiveSummary {
  const events = metricValue(metrics, 'fire_events')
  const findings = metricValue(metrics, 'findings_active')
  const verifNeeds = metricValue(metrics, 'verification_needs_active')
  const verifLegacy = metricValue(metrics, 'verification_plans_legacy')
  const assessments = metricValue(metrics, 'response_assessments')
  const incidentsLegacy = legacyBreakdown(metrics, 'incidents_operational')
  const missionsDemo = demoBreakdown(metrics, 'missions_operational')
  const pendingDecisions = dashboard?.pending_decisions.length ?? 0

  const what_is_happening =
    events > 0 || findings > 0
      ? `TerraMind monitorea ${events} evento(s) térmico(s) agrupados y ${findings} hallazgo(s) activos.`
      : 'TerraMind está operativo; no hay eventos térmicos agrupados recientes en la ventana activa.'

  const periodChanges = dashboard
    ? filterEntriesByPeriod(dashboard.recent_changes, periodHours)
    : []
  const what_changed =
    periodChanges.length > 0
      ? `${periodChanges.length} cambio(s) registrados en la línea nacional durante el período seleccionado.`
      : 'No hay una comparación histórica suficiente para determinar cambios en este período.'

  const topCount = Math.min(3, dashboard?.priority_findings.length ?? 0)
  const requires_attention =
    topCount > 0
      ? `Revisar ${topCount} prioridad(es) destacadas en el mapa y la lista de hallazgos.`
      : findings > 0
        ? 'Revisar hallazgos activos con mayor severidad en el mapa nacional.'
        : 'Mantener monitoreo de fuentes FIRMS y pipelines de enriquecimiento.'

  const parts: string[] = []
  parts.push(`Verificaciones activas (operacional): ${verifNeeds}.`)
  if (verifLegacy > 0) parts.push(`${verifLegacy} plan(es) legacy fuera del conteo operacional.`)
  if (incidentsLegacy > 0) parts.push(`${incidentsLegacy} incidente(s) legacy pendientes de ownership.`)
  if (missionsDemo > 0 && dashboard?.include_demo) {
    parts.push(`${missionsDemo} misión(es) de demostración visibles.`)
  }
  const in_verification = parts.join(' ')

  const terramind_recommends =
    assessments > 0
      ? `${assessments} evaluación(es) de respuesta vigente(s) — revisar en Respuesta operacional.`
      : pendingDecisions > 0
        ? `${pendingDecisions} decisión(es) pendiente(s) de resolución humana.`
        : 'Aún no existe una recomendación operacional formal. Se generará después de resolver una verificación.'

  return {
    what_is_happening,
    what_changed,
    requires_attention,
    in_verification,
    terramind_recommends,
  }
}
