import type { ExecutiveDashboardDto } from '@/modules/executive-demo/types/executive-demo.types'
import type { ExecutiveMetric } from '@/modules/executive-metrics/executive-metric.types'
import { pluralizeCount } from '@/shared/format/plural'
import { filterEntriesByPeriod } from './national-situation.constants'
import { normalizeNationalSituationDashboardDto } from './national-situation-dashboard.normalize'
import { periodWindowPhrase, spellCount } from './utils/situation-labels'

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
  return (
    m?.breakdown?.filter((b) => !b.included && b.classification === 'legacy').reduce((s, b) => s + b.value, 0) ?? 0
  )
}

function demoBreakdown(metrics: ExecutiveMetric[], id: string): number {
  const m = metrics.find((x) => x.id === id)
  return (
    m?.breakdown?.filter((b) => !b.included && b.classification === 'demo').reduce((s, b) => s + b.value, 0) ?? 0
  )
}

/** Spanish sentence joining an arbitrary list with commas + "y". */
function joinSpanish(parts: string[]): string {
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

/**
 * Deterministic executive summary for Situación Nacional (Phase 3 §7).
 * Uses canonical metrics + dashboard slices — no LLM, natural Spanish only.
 */
export function buildNationalExecutiveSummary(
  metrics: ExecutiveMetric[],
  dashboardInput: ExecutiveDashboardDto | undefined,
  periodHours = 48,
): NationalExecutiveSummary {
  // Guarantee every optional collection is an array so a single missing field
  // in the payload can never crash the page (see normalizer contract).
  const dashboard = normalizeNationalSituationDashboardDto(dashboardInput)
  const safeMetrics = Array.isArray(metrics) ? metrics : []
  const events = metricValue(safeMetrics, 'fire_events')
  const findings = metricValue(safeMetrics, 'findings_active')
  const verifNeeds = metricValue(safeMetrics, 'verification_needs_active')
  const verifLegacy = metricValue(safeMetrics, 'verification_plans_legacy')
  const assessments = metricValue(safeMetrics, 'response_assessments')
  const incidentsLegacy = legacyBreakdown(safeMetrics, 'incidents_operational')
  const missionsDemo = demoBreakdown(safeMetrics, 'missions_operational')
  const pendingDecisions = dashboard?.pending_decisions.length ?? 0

  const what_is_happening =
    events > 0 || findings > 0
      ? `TerraMind monitorea ${pluralizeCount(events, 'evento térmico agrupado', 'eventos térmicos agrupados')} y ${pluralizeCount(findings, 'hallazgo activo', 'hallazgos activos')}.`
      : 'TerraMind está operativo; no hay eventos térmicos agrupados recientes en la ventana activa.'

  const periodChanges = dashboard
    ? filterEntriesByPeriod(dashboard.recent_changes, periodHours)
    : []
  // Los cambios de prioridad se incorporarán cuando exista una fuente temporal canónica para esa etapa.
  const newEvents = periodChanges.filter((e) => e.stage === 'event').length
  const newFindings = periodChanges.filter((e) => e.stage === 'finding').length
  const newIncidents = periodChanges.filter((e) => e.stage === 'incident').length
  const newMissions = periodChanges.filter((e) => e.stage === 'mission').length
  const deltaParts: string[] = []
  if (newEvents > 0) deltaParts.push(pluralizeCount(newEvents, 'evento nuevo', 'eventos nuevos'))
  if (newFindings > 0)
    deltaParts.push(pluralizeCount(newFindings, 'hallazgo nuevo', 'hallazgos nuevos'))
  if (newIncidents > 0)
    deltaParts.push(pluralizeCount(newIncidents, 'incidente nuevo', 'incidentes nuevos'))
  if (newMissions > 0)
    deltaParts.push(pluralizeCount(newMissions, 'misión actualizada', 'misiones actualizadas'))
  const what_changed =
    deltaParts.length > 0
      ? `Durante ${periodWindowPhrase(periodHours)} se registraron ${joinSpanish(deltaParts)}.`
      : 'No hay suficiente historial comparable para identificar cambios durante este periodo.'

  const topCount = dashboard?.top_priorities.length ?? 0
  const requires_attention =
    topCount > 0
      ? `Revisar ${pluralizeCount(topCount, 'prioridad destacada', 'prioridades destacadas')} en el mapa y la cola de prioridades.`
      : findings > 0
        ? 'Revisar los hallazgos activos con mayor severidad en el mapa nacional.'
        : 'Mantener el monitoreo de las fuentes FIRMS y de los procesos de enriquecimiento.'

  const parts: string[] = []
  parts.push(
    verifNeeds > 0
      ? `Hay ${pluralizeCount(verifNeeds, 'verificación operativa activa', 'verificaciones operativas activas')}.`
      : 'No hay verificaciones operativas activas.',
  )
  const historical: string[] = []
  if (verifLegacy > 0) {
    historical.push(
      `${spellCount(verifLegacy)} ${verifLegacy === 1 ? 'plan histórico' : 'planes históricos'}`,
    )
  }
  if (incidentsLegacy > 0) {
    historical.push(
      `${spellCount(incidentsLegacy)} ${incidentsLegacy === 1 ? 'incidente' : 'incidentes'} pendientes de asignación organizacional`,
    )
  }
  if (historical.length > 0) {
    const verb = historical.length === 1 ? 'Existe' : 'Existen'
    parts.push(`${verb} ${joinSpanish(historical)}.`)
  }
  if (missionsDemo > 0 && dashboard?.include_demo) {
    parts.push(
      `${pluralizeCount(missionsDemo, 'misión de demostración visible', 'misiones de demostración visibles')}.`,
    )
  }
  const in_verification = parts.join(' ')

  const terramind_recommends =
    assessments > 0
      ? `Hay ${pluralizeCount(assessments, 'evaluación de respuesta vigente', 'evaluaciones de respuesta vigentes')} — revisar en Respuesta operacional.`
      : pendingDecisions > 0
        ? `Hay ${pluralizeCount(pendingDecisions, 'decisión pendiente', 'decisiones pendientes')} de resolución humana.`
        : 'Aún no existe una recomendación operacional formal. Se generará después de resolver una verificación.'

  return {
    what_is_happening,
    what_changed,
    requires_attention,
    in_verification,
    terramind_recommends,
  }
}
