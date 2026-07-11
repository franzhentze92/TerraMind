import type { MetricRegistryEntry } from '@/modules/executive-metrics/metric-registry'
import { getMetricRegistryEntry } from '@/modules/executive-metrics/metric-registry'
import type { MetricScope, OwnershipClass, TimeWindowKey } from '@/modules/executive-metrics/metric-taxonomy'
import { humanizeToken } from '@/shared/product-language'

export interface MethodologyDetailLine {
  label: string
  value: string
}

export interface SituationMethodologyPresentation {
  /** Primary human explanation — never raw table or enum tokens. */
  summary: string
  lines: MethodologyDetailLine[]
  /** Exact identifiers for the collapsible admin block only. */
  technicalReference: string
}

const TIME_WINDOW_LABELS: Record<TimeWindowKey, string> = {
  '24h': 'Últimas 24 horas',
  '48h': 'Últimas 48 horas',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  all_time: 'Histórico completo',
  current_state: 'Estado actual',
}

const SCOPE_LABELS: Record<MetricScope, string> = {
  national: 'Nacional',
  organization: 'Organización activa',
  user: 'Usuario',
  mission: 'Misión',
  incident: 'Incidente',
  demo: 'Demostración',
}

const OWNERSHIP_LABELS: Record<OwnershipClass, string> = {
  tenant_owned: 'Perteneciente a la organización',
  global_public_data: 'Dato público nacional',
  legacy_unowned: 'Histórico sin organización',
  demo_owned: 'Demostración interna',
  system_internal: 'Interno del sistema',
}

const DEMO_POLICY_LABELS: Record<string, string> = {
  excluded_by_default: 'Excluida por defecto del conteo operacional',
  demo_only: 'Solo demostración',
  not_applicable: 'No aplica',
}

const LEGACY_POLICY_LABELS: Record<string, string> = {
  excluded_from_operational: 'Excluidos del conteo operacional',
  legacy_only: 'Solo registros históricos',
  not_applicable: 'No aplica',
}

/** Human-readable source — no bare table names in the main panel. */
const SOURCE_HUMAN: Record<string, string> = {
  'fire_ingestion_runs.rows_received': 'Registros brutos de la última ingesta FIRMS',
  'fire_detections (is_inside_guatemala = true)': 'Detecciones térmicas dentro de Guatemala',
  fire_events: 'Eventos térmicos agrupados',
  'fire_events (risk_level = atencion)': 'Eventos térmicos con nivel de atención',
  'composite_findings (status = active)': 'Hallazgos compuestos con estado activo',
  'composite_findings (status = monitoring)': 'Hallazgos compuestos en monitoreo',
  'composite_findings (status = resolved)': 'Hallazgos compuestos resueltos',
  composite_findings: 'Hallazgos compuestos',
  'finding_priority_assessments (assessment_status = active)':
    'Evaluaciones de prioridad activas sobre eventos térmicos',
  'incidents (organization_id = organización activa)':
    'Incidentes de la organización activa',
  'incidents (organization_id IS NULL)': 'Incidentes históricos sin organización asignada',
  missions: 'Misiones de campo',
  'missions (título Field Sync Pilot)': 'Misiones del piloto interno de demostración',
  evidence_submissions: 'Envíos de evidencia de campo',
  'evidence_submissions (misión piloto)': 'Evidencia de misiones de demostración',
  'verification_plans (legacy)': 'Planes de verificación históricos',
  'verification_needs (active)': 'Necesidades de verificación activas',
  'situation report (pipeline)': 'Informe de situación del flujo de datos',
}

function methodologyTimeWindowLabel(key: TimeWindowKey): string {
  return TIME_WINDOW_LABELS[key] ?? humanizeToken(key)
}

function methodologyScopeLabel(scope: MetricScope): string {
  return SCOPE_LABELS[scope] ?? humanizeToken(scope)
}

function humanizeMetricSource(source: string): string {
  if (SOURCE_HUMAN[source]) return SOURCE_HUMAN[source]
  const withoutParens = source.replace(/\s*\([^)]*\)/, '').trim()
  if (SOURCE_HUMAN[withoutParens]) return SOURCE_HUMAN[withoutParens]
  return 'Fuente de datos del sistema'
}

/** Translate status_filter for the main panel (never raw SQL-like tokens). */
function humanizeStatusFilter(filter: string): string {
  const map: Record<string, string> = {
    "status = 'active'": 'Activo',
    "status = 'monitoring'": 'En monitoreo',
    "status = 'resolved'": 'Resuelto',
    'todos los estados': 'Todos los estados',
    "status != 'merged', organization_id no nulo": 'Sin fusionar, con organización asignada',
    "status != 'merged', organization_id nulo": 'Sin fusionar, sin organización asignada',
    "assessment_status = 'active', entity_type = 'fire_event'":
      'Evaluación activa sobre evento térmico',
    'is_inside_guatemala = true, acquired_at_utc en ventana':
      'Dentro de Guatemala en la ventana seleccionada',
    'last_detected_at en ventana': 'Última detección dentro de la ventana',
    "risk_level = 'atencion'": 'Nivel de atención elevado',
    'última corrida de ingesta exitosa': 'Última ingesta completada con éxito',
    'fuentes con estado connected': 'Fuentes conectadas y operativas',
  }
  return map[filter] ?? filter.replace(/\bactive\b/gi, 'activo').replace(/\bstatus\b/gi, 'estado')
}

function sanitizeMethodologySpanish(text: string): string {
  return text
    .replace(/\blegacy\b/gi, 'registros históricos')
    .replace(/\bdemo\b/gi, 'demostración')
    .replace(/\boperational\b/gi, 'operacional')
    .replace(/\borganization_id\b/g, 'organización')
    .replace(/\btenant\b/gi, 'organización')
    .replace(/\bstatus\b/gi, 'estado')
    .replace(/\bactive\b/gi, 'activo')
    .replace(/\bcurrent_state\b/g, 'estado actual')
    .replace(/\btime_window\b/g, 'ventana temporal')
    .replace(/composite_findings/g, 'hallazgos compuestos')
    .replace(/finding_priority_assessments/g, 'evaluaciones de prioridad')
}

function formatTechnicalSource(entry: MetricRegistryEntry): string {
  const raw = entry.source_table_or_service
  const parenMatch = raw.match(/^([^\s(]+)\s*\(([^)]+)\)$/)
  if (parenMatch) {
    const table = parenMatch[1]
    const clause = parenMatch[2].trim()
    const eqMatch = clause.match(/(\w+)\s*=\s*'?(\w+)'?/)
    if (eqMatch) {
      return `${table}.${eqMatch[1]} = '${eqMatch[2]}'`
    }
    return `${table} (${clause})`
  }
  return raw
}

function buildTechnicalReference(entry: MetricRegistryEntry): string {
  const lines = [
    formatTechnicalSource(entry),
    `Estado: ${entry.status_filter}`,
    `Ventana temporal: ${entry.time_window}`,
    `Alcance: ${entry.scope}`,
    `Actualizado desde: ${entry.last_updated_source}`,
    `Regla de deduplicación: ${entry.deduplication_rule}`,
  ]
  if (entry.demo_policy !== 'not_applicable') {
    lines.push(`Política de demostración: ${entry.demo_policy}`)
  }
  if (entry.legacy_policy !== 'not_applicable') {
    lines.push(`Política histórica: ${entry.legacy_policy}`)
  }
  return lines.join('\n')
}

/**
 * Situación Nacional — methodology panel presentation.
 * Registry values stay untouched; this layer produces Spanish UI copy only.
 */
export function buildSituationMethodologyPresentation(
  metricId: string,
): SituationMethodologyPresentation | null {
  const entry = getMetricRegistryEntry(metricId)
  if (!entry) return null

  const lines: MethodologyDetailLine[] = [
    { label: 'Fuente', value: humanizeMetricSource(entry.source_table_or_service) },
    { label: 'Ventana temporal', value: methodologyTimeWindowLabel(entry.time_window) },
    { label: 'Alcance', value: methodologyScopeLabel(entry.scope) },
    { label: 'Estado contado', value: humanizeStatusFilter(entry.status_filter) },
    { label: 'Regla de deduplicación', value: sanitizeMethodologySpanish(entry.deduplication_rule) },
    { label: 'Limitaciones', value: sanitizeMethodologySpanish(entry.confidence_or_limitations) },
  ]

  if (entry.legacy_policy !== 'not_applicable') {
    lines.push({
      label: 'Registros históricos',
      value: LEGACY_POLICY_LABELS[entry.legacy_policy] ?? humanizeToken(entry.legacy_policy),
    })
  }
  if (entry.demo_policy !== 'not_applicable') {
    lines.push({
      label: 'Demostración',
      value: DEMO_POLICY_LABELS[entry.demo_policy] ?? humanizeToken(entry.demo_policy),
    })
  }

  lines.push({
    label: 'Propiedad de los datos',
    value: OWNERSHIP_LABELS[entry.ownership_policy] ?? humanizeToken(entry.ownership_policy),
  })

  return {
    summary: sanitizeMethodologySpanish(entry.description),
    lines,
    technicalReference: buildTechnicalReference(entry),
  }
}

/** Flatten main-panel text for language-hygiene tests (excludes technical reference). */
export function methodologyMainPanelText(presentation: SituationMethodologyPresentation): string {
  return [presentation.summary, ...presentation.lines.map((l) => `${l.label} ${l.value}`)].join('\n')
}

/** Tokens that must never appear untranslated in the main methodology panel. */
export const METHODOLOGY_FORBIDDEN_MAIN_TOKENS = [
  'current_state',
  'status = active',
  'time_window',
  'operational',
  'legacy',
  'demo',
  'composite_findings',
  'tenant_owned',
  'global_public_data',
] as const
