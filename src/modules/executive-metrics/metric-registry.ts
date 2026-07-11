/**
 * Machine-readable inventory of every canonical metric.
 *
 * Product Consolidation — Phase 1. Each metric the product shows must be
 * declared here with its full provenance. The product-truth audit fails if the
 * Executive Metrics Service emits a metric id that is not registered, or if a
 * registered metric omits a time window, source or breakdown policy.
 */

import type {
  MetricScope,
  OwnershipClass,
  TimeWindowKey,
} from '@/modules/executive-metrics/metric-taxonomy'

export type DemoPolicy = 'excluded_by_default' | 'demo_only' | 'not_applicable'
export type LegacyPolicy = 'excluded_from_operational' | 'legacy_only' | 'not_applicable'

export interface MetricRegistryEntry {
  metric_id: string
  label: string
  description: string
  source_table_or_service: string
  scope: MetricScope
  ownership_policy: OwnershipClass
  demo_policy: DemoPolicy
  legacy_policy: LegacyPolicy
  time_window: TimeWindowKey
  status_filter: string
  deduplication_rule: string
  unit: string
  last_updated_source: string
  confidence_or_limitations: string
}

export const METRIC_REGISTRY: MetricRegistryEntry[] = [
  /* ------------------------------- FIRES -------------------------------- */
  {
    metric_id: 'fire_observations',
    label: 'Observaciones recibidas',
    description:
      'Registros brutos descargados de NASA FIRMS en la última corrida de ingesta, antes de filtrar por territorio.',
    source_table_or_service: 'fire_ingestion_runs.rows_received',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: '48h',
    status_filter: 'última corrida de ingesta exitosa',
    deduplication_rule: 'sin deduplicar (conteo bruto de la corrida)',
    unit: 'observaciones',
    last_updated_source: 'fire_ingestion_runs.finished_at',
    confidence_or_limitations:
      'Conteo bruto global de una sola corrida; no es subconjunto directo de detecciones persistidas.',
  },
  {
    metric_id: 'fire_detections_national',
    label: 'Detecciones dentro de Guatemala',
    description:
      'Detecciones térmicas persistidas dentro del territorio de Guatemala en la ventana de tiempo.',
    source_table_or_service: 'fire_detections (is_inside_guatemala = true)',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: '48h',
    status_filter: 'is_inside_guatemala = true, acquired_at_utc en ventana',
    deduplication_rule: 'una fila por detección persistida',
    unit: 'detecciones',
    last_updated_source: 'fire_detections.acquired_at_utc (máximo en ventana)',
    confidence_or_limitations: 'Puede abarcar varias corridas de ingesta dentro de la ventana.',
  },
  {
    metric_id: 'fire_events',
    label: 'Eventos térmicos agrupados',
    description: 'Detecciones agrupadas en eventos térmicos por el motor de clustering.',
    source_table_or_service: 'fire_events',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: '48h',
    status_filter: 'last_detected_at en ventana',
    deduplication_rule: 'una fila por evento agrupado',
    unit: 'eventos',
    last_updated_source: 'fire_events.last_detected_at (máximo en ventana)',
    confidence_or_limitations: 'Un evento agrupa múltiples detecciones; no es comparable 1:1 con observaciones.',
  },
  {
    metric_id: 'fire_events_attention',
    label: 'Eventos con atención',
    description: 'Eventos térmicos con nivel de riesgo de atención dentro de la ventana.',
    source_table_or_service: 'fire_events (risk_level = atencion)',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: '48h',
    status_filter: "risk_level = 'atencion'",
    deduplication_rule: 'una fila por evento',
    unit: 'eventos',
    last_updated_source: 'fire_events.last_detected_at',
    confidence_or_limitations: 'Depende del modelo de riesgo vigente.',
  },
  /* ------------------------------ FINDINGS ------------------------------ */
  {
    metric_id: 'findings_active',
    label: 'Hallazgos activos',
    description: 'Hallazgos compuestos en estado activo (inteligencia nacional).',
    source_table_or_service: 'composite_findings (status = active)',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: 'current_state',
    status_filter: "status = 'active'",
    deduplication_rule: 'una fila por hallazgo',
    unit: 'hallazgos',
    last_updated_source: 'composite_findings.generated_at',
    confidence_or_limitations:
      'Dato nacional sin organization_id; visible para todos los usuarios autorizados (no se filtra por tenant).',
  },
  {
    metric_id: 'findings_monitoring',
    label: 'Hallazgos en monitoreo',
    description: 'Hallazgos compuestos en estado de monitoreo.',
    source_table_or_service: 'composite_findings (status = monitoring)',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: 'current_state',
    status_filter: "status = 'monitoring'",
    deduplication_rule: 'una fila por hallazgo',
    unit: 'hallazgos',
    last_updated_source: 'composite_findings.generated_at',
    confidence_or_limitations: 'Dato nacional sin organization_id.',
  },
  {
    metric_id: 'findings_resolved',
    label: 'Hallazgos resueltos',
    description: 'Hallazgos compuestos en estado resuelto.',
    source_table_or_service: 'composite_findings (status = resolved)',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: 'current_state',
    status_filter: "status = 'resolved'",
    deduplication_rule: 'una fila por hallazgo',
    unit: 'hallazgos',
    last_updated_source: 'composite_findings.generated_at',
    confidence_or_limitations: 'Dato nacional sin organization_id.',
  },
  {
    metric_id: 'findings_total',
    label: 'Hallazgos totales',
    description: 'Total de hallazgos compuestos, cualquier estado.',
    source_table_or_service: 'composite_findings',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: 'current_state',
    status_filter: 'todos los estados',
    deduplication_rule: 'una fila por hallazgo',
    unit: 'hallazgos',
    last_updated_source: 'composite_findings.generated_at',
    confidence_or_limitations: 'Dato nacional sin organization_id.',
  },
  /* ----------------------------- PRIORITIES ----------------------------- */
  {
    metric_id: 'priorities_total',
    label: 'Prioridades evaluadas',
    description: 'Evaluaciones de prioridad activas sobre eventos térmicos.',
    source_table_or_service: 'finding_priority_assessments (assessment_status = active)',
    scope: 'national',
    ownership_policy: 'global_public_data',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: 'current_state',
    status_filter: "assessment_status = 'active', entity_type = 'fire_event'",
    deduplication_rule: 'una fila por evaluación activa',
    unit: 'evaluaciones',
    last_updated_source: 'finding_priority_assessments.updated_at',
    confidence_or_limitations: 'Dato nacional sin organization_id.',
  },
  /* ----------------------------- INCIDENTS ------------------------------ */
  {
    metric_id: 'incidents_operational',
    label: 'Incidentes operacionales',
    description:
      'Incidentes correlacionados pertenecientes a la organización activa (excluye legacy y demo).',
    source_table_or_service: 'incidents (organization_id = organización activa)',
    scope: 'organization',
    ownership_policy: 'tenant_owned',
    demo_policy: 'excluded_by_default',
    legacy_policy: 'excluded_from_operational',
    time_window: 'current_state',
    status_filter: "status != 'merged', organization_id no nulo",
    deduplication_rule: 'una fila por incidente',
    unit: 'incidentes',
    last_updated_source: 'incidents.last_observed_at',
    confidence_or_limitations:
      'KPI principal operacional; los incidentes legacy sin organización se reportan aparte.',
  },
  {
    metric_id: 'incidents_legacy',
    label: 'Incidentes legacy pendientes de asignación organizacional',
    description: 'Incidentes históricos sin organization_id, visibles pero fuera del KPI operacional.',
    source_table_or_service: 'incidents (organization_id IS NULL)',
    scope: 'national',
    ownership_policy: 'legacy_unowned',
    demo_policy: 'excluded_by_default',
    legacy_policy: 'legacy_only',
    time_window: 'current_state',
    status_filter: "status != 'merged', organization_id nulo",
    deduplication_rule: 'una fila por incidente',
    unit: 'incidentes',
    last_updated_source: 'incidents.last_observed_at',
    confidence_or_limitations: 'Ownership pendiente; no genera evaluaciones, decisiones ni misiones.',
  },
  /* ------------------------------ MISSIONS ------------------------------ */
  {
    metric_id: 'missions_operational',
    label: 'Misiones operacionales',
    description: 'Misiones de campo reales de la organización activa (excluye piloto/demo).',
    source_table_or_service: 'missions',
    scope: 'organization',
    ownership_policy: 'tenant_owned',
    demo_policy: 'excluded_by_default',
    legacy_policy: 'excluded_from_operational',
    time_window: 'current_state',
    status_filter: 'excluye títulos de piloto interno (Field Sync Pilot)',
    deduplication_rule: 'una fila por misión',
    unit: 'misiones',
    last_updated_source: 'missions.updated_at',
    confidence_or_limitations:
      'La marca demo se infiere del título de la misión (heurística), no de una columna dedicada.',
  },
  {
    metric_id: 'missions_demo',
    label: 'Misiones de demostración interna',
    description: 'Misiones del piloto interno (Field Sync Pilot). Nunca suman al KPI operacional.',
    source_table_or_service: 'missions (título Field Sync Pilot)',
    scope: 'demo',
    ownership_policy: 'demo_owned',
    demo_policy: 'demo_only',
    legacy_policy: 'not_applicable',
    time_window: 'current_state',
    status_filter: "title contiene 'Field Sync Pilot'",
    deduplication_rule: 'una fila por misión',
    unit: 'misiones',
    last_updated_source: 'missions.updated_at',
    confidence_or_limitations: 'Solo se muestra cuando include_demo=true, siempre en breakdown separado.',
  },
  /* ------------------------------ EVIDENCE ------------------------------ */
  {
    metric_id: 'evidence_operational',
    label: 'Evidencia operacional',
    description: 'Envíos de evidencia asociados a misiones operacionales reales.',
    source_table_or_service: 'evidence_submissions',
    scope: 'organization',
    ownership_policy: 'tenant_owned',
    demo_policy: 'excluded_by_default',
    legacy_policy: 'excluded_from_operational',
    time_window: 'current_state',
    status_filter: 'excluye envíos de misiones piloto',
    deduplication_rule: 'una fila por envío (submission)',
    unit: 'envíos',
    last_updated_source: 'evidence_submissions.created_at',
    confidence_or_limitations: 'El estatus piloto se hereda del título de la misión dueña.',
  },
  {
    metric_id: 'evidence_demo',
    label: 'Evidencia de piloto interno',
    description: 'Envíos de evidencia de misiones piloto (Field Sync Pilot).',
    source_table_or_service: 'evidence_submissions (misión piloto)',
    scope: 'demo',
    ownership_policy: 'demo_owned',
    demo_policy: 'demo_only',
    legacy_policy: 'not_applicable',
    time_window: 'current_state',
    status_filter: 'mission_id pertenece a misión piloto',
    deduplication_rule: 'una fila por envío',
    unit: 'envíos',
    last_updated_source: 'evidence_submissions.created_at',
    confidence_or_limitations: 'Solo visible con include_demo=true.',
  },
  /* --------------------------- VERIFICATION ----------------------------- */
  {
    metric_id: 'verification_plans_legacy',
    label: 'Planes de verificación legacy',
    description:
      'Planes de verificación de versiones anteriores del modelo, no operacionales por sí mismos.',
    source_table_or_service: 'verification_plans',
    scope: 'national',
    ownership_policy: 'legacy_unowned',
    demo_policy: 'excluded_by_default',
    legacy_policy: 'legacy_only',
    time_window: 'current_state',
    status_filter: "status in ('draft','ready','not_required','blocked')",
    deduplication_rule: 'una fila por plan',
    unit: 'planes',
    last_updated_source: 'verification_plans.updated_at',
    confidence_or_limitations:
      'Los planes not_required tienen 0 necesidades por construcción; no equivalen a necesidades activas.',
  },
  {
    metric_id: 'verification_needs_active',
    label: 'Necesidades de verificación activas',
    description: 'Necesidades de verificación sin resolver del plan activo del modelo vigente.',
    source_table_or_service: 'verification_needs',
    scope: 'incident',
    ownership_policy: 'tenant_owned',
    demo_policy: 'excluded_by_default',
    legacy_policy: 'excluded_from_operational',
    time_window: 'current_state',
    status_filter: 'plan activo del modelo vigente, necesidad sin resolver',
    deduplication_rule: 'una fila por necesidad',
    unit: 'necesidades',
    last_updated_source: 'verification_needs.updated_at',
    confidence_or_limitations: 'Solo cuenta necesidades del plan activo del modelo actual.',
  },
  /* ------------------------------ RESPONSE ------------------------------ */
  {
    metric_id: 'response_assessments',
    label: 'Evaluaciones de respuesta',
    description:
      'Evaluaciones de respuesta de la organización activa. Se generan tras una resolución de verificación con reevaluaciones completas.',
    source_table_or_service: 'response_assessments',
    scope: 'organization',
    ownership_policy: 'tenant_owned',
    demo_policy: 'excluded_by_default',
    legacy_policy: 'excluded_from_operational',
    time_window: 'current_state',
    status_filter: 'is_active, organización activa',
    deduplication_rule: 'una fila por evaluación activa',
    unit: 'evaluaciones',
    last_updated_source: 'response_assessments.updated_at',
    confidence_or_limitations:
      'organization_id NOT NULL: los incidentes legacy/demo nunca generan evaluaciones.',
  },
  /* ------------------------------- SOURCES ------------------------------ */
  {
    metric_id: 'sources_active',
    label: 'Fuentes activas',
    description: 'Fuentes de datos conectadas y operativas.',
    source_table_or_service: 'situation report (pipeline)',
    scope: 'national',
    ownership_policy: 'system_internal',
    demo_policy: 'not_applicable',
    legacy_policy: 'not_applicable',
    time_window: 'current_state',
    status_filter: 'fuentes con estado connected',
    deduplication_rule: 'una por fuente',
    unit: 'fuentes',
    last_updated_source: 'situation.lastSyncAt',
    confidence_or_limitations: 'Refleja el estado del pipeline en memoria, no un conteo de tablas.',
  },
]

const REGISTRY_BY_ID = new Map(METRIC_REGISTRY.map((m) => [m.metric_id, m]))

export function getMetricRegistryEntry(metricId: string): MetricRegistryEntry | undefined {
  return REGISTRY_BY_ID.get(metricId)
}

export function isRegisteredMetric(metricId: string): boolean {
  return REGISTRY_BY_ID.has(metricId)
}

export const REGISTERED_METRIC_IDS: string[] = METRIC_REGISTRY.map((m) => m.metric_id)
