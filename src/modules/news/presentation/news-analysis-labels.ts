/**
 * Etiquetas visibles en español — análisis documental N2.
 */
import type { NewsAnalysisStatus } from '@/pipeline/stores/news-analysis.store'

export const ANALYSIS_STATUS_LABELS: Record<NewsAnalysisStatus, string> = {
  queued: 'En cola',
  processing: 'Procesando',
  completed: 'Completado',
  completed_with_warnings: 'Completado con advertencias',
  failed: 'Error',
  needs_review: 'Requiere revisión',
  rejected: 'Rechazado',
}

export const EPISTEMIC_STATUS_LABELS: Record<string, string> = {
  explicitly_reported: 'Reportado explícitamente',
  attributed_report: 'Atribuido a una fuente',
  inferred: 'Inferido',
  uncertain: 'Incierto',
  contradicted: 'Contradicho',
}

export const CLAIM_TYPE_LABELS: Record<string, string> = {
  action: 'Acción',
  state: 'Estado',
  decision: 'Decisión',
  change: 'Cambio',
  measurement: 'Medición',
  consequence: 'Consecuencia',
  allegation: 'Acusación',
  prediction: 'Predicción',
  denial: 'Negación',
  confirmation: 'Confirmación',
  relationship: 'Relación',
}

export const ENTITY_STATUS_LABELS: Record<string, string> = {
  confirmed_in_text: 'Mencionada explícitamente',
  candidate: 'Candidata',
  inferred: 'Inferida',
}

export const LOCATION_ROLE_LABELS: Record<string, string> = {
  primary_event: 'Lugar principal del hecho',
  mentioned: 'Lugar mencionado',
  person_origin: 'Origen de persona',
  institutional_seat: 'Sede institucional',
  potentially_affected: 'Lugar potencialmente afectado',
  national_coverage: 'Cobertura nacional',
  international: 'Internacional',
}

export const TEMPORAL_ROLE_LABELS: Record<string, string> = {
  event_date: 'Fecha del hecho',
  reported_date: 'Fecha reportada',
  antecedent_date: 'Fecha de antecedente',
  estimated: 'Fecha estimada',
  future_horizon: 'Horizonte futuro',
  relative: 'Referencia relativa',
  unspecified: 'No especificada',
}

export const PROMOTION_RECOMMENDATION_LABELS: Record<string, string> = {
  none: 'No propuesto',
  needs_related_documents: 'Requiere noticias relacionadas',
  ready_for_grouping: 'Listo para agrupación',
  human_review_required: 'Requiere revisión humana',
}

export const SENSITIVITY_FLAG_LABELS: Record<string, string> = {
  legal_allegation: 'Acusación legal',
  criminal_proceeding: 'Proceso judicial',
  judicial_process: 'Proceso judicial',
  fatality: 'Fallecimiento reportado',
  death: 'Fallecimiento reportado',
  personal_data: 'Datos personales',
  unidentified_persons: 'Personas no identificadas',
  minor: 'Menor de edad',
  health_information: 'Información de salud',
  political_sensitivity: 'Contenido político delicado',
  corruption_allegation: 'Acusación de corrupción',
  violence: 'Violencia',
  reputational_impact: 'Posible impacto reputacional',
  unverified_accusation: 'Acusación no verificada',
  natural_disaster: 'Desastre natural',
  rainy_season_impact: 'Impacto por temporada lluviosa',
  missing_persons: 'Personas desaparecidas',
  housing_damage: 'Daño habitacional',
  national_emergency: 'Emergencia nacional en evolución',
}

/** Motivo/consecuencia por defecto cuando el modelo no los provee. */
export const SENSITIVITY_DEFAULTS: Record<string, { reason: string; consequence: string }> = {
  criminal_proceeding: {
    reason: 'La noticia describe un proceso judicial.',
    consequence: 'Requiere revisión humana antes de cualquier promoción.',
  },
  judicial_process: {
    reason: 'La noticia describe un proceso judicial.',
    consequence: 'Requiere revisión humana antes de cualquier promoción.',
  },
  fatality: {
    reason: 'Se reporta el fallecimiento de una persona.',
    consequence: 'Requiere revisión humana y trato prudente.',
  },
  death: {
    reason: 'Se reporta el fallecimiento de una persona.',
    consequence: 'Requiere revisión humana y trato prudente.',
  },
  unidentified_persons: {
    reason: 'Hay personas no identificadas en el relato.',
    consequence: 'No deben inferirse identidades.',
  },
  reputational_impact: {
    reason: 'El contenido puede afectar la reputación de personas involucradas.',
    consequence: 'Requiere revisión humana antes de difundir.',
  },
  natural_disaster: {
    reason: 'El documento reporta un impacto significativo asociado a un fenómeno natural.',
    consequence: 'Revisión recomendada antes de promover a evento; las cifras pueden actualizarse.',
  },
  rainy_season_impact: {
    reason: 'Balance de impactos acumulados de temporada lluviosa, con población damnificada y emergencias.',
    consequence: 'Revisión recomendada antes de promover a evento; conviene contraste con el informe institucional original.',
  },
  missing_persons: {
    reason: 'Se reportan personas desaparecidas.',
    consequence: 'Requiere seguimiento y trato prudente; no inferir identidades.',
  },
  housing_damage: {
    reason: 'Se reportan daños habitacionales.',
    consequence: 'Revisión recomendada antes de usar las cifras en decisiones operativas.',
  },
  national_emergency: {
    reason: 'Emergencia de alcance nacional o con múltiples departamentos, en evolución.',
    consequence: 'Revisión recomendada antes de promover a evento; el balance puede cambiar tras el corte.',
  },
}

export const EVIDENCE_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  subtitle: 'Subtítulo',
  description: 'Descripción',
  permitted_excerpt: 'Extracto permitido',
  source_category: 'Categoría de la fuente',
  source_tags: 'Etiquetas',
  json_ld: 'Datos estructurados',
  open_graph: 'Metadatos Open Graph',
}

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  corrected: 'Corregido',
}

export function analysisStatusLabel(status: string): string {
  return ANALYSIS_STATUS_LABELS[status as NewsAnalysisStatus] ?? status
}

export function epistemicStatusLabel(status: string): string {
  return EPISTEMIC_STATUS_LABELS[status] ?? status
}

export function claimTypeLabel(type: string): string {
  return CLAIM_TYPE_LABELS[type] ?? type
}

export function sensitivityFlagLabel(flag: string): string {
  return sensitivitySpecificLabel(flag)
}

export function promotionRecommendationLabel(value: string): string {
  return PROMOTION_RECOMMENDATION_LABELS[value] ?? value
}

export function evidenceFieldLabel(field: string): string {
  return EVIDENCE_FIELD_LABELS[field] ?? field
}

/** Etiquetas visibles para tipos de entidad (incluye hechos/decisiones/objetos). */
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  person: 'Persona',
  persona: 'Persona',
  institution: 'Institución',
  institucion: 'Institución',
  organization: 'Organización',
  organizacion: 'Organización',
  vehicle: 'Vehículo',
  vehiculo: 'Vehículo',
  place: 'Lugar',
  lugar: 'Lugar',
  city: 'Ciudad',
  ciudad: 'Ciudad',
  source: 'Fuente documental',
  fuente: 'Fuente documental',
  document_source: 'Fuente documental',
  event_occurrence: 'Hecho',
  hecho: 'Hecho',
  decision: 'Decisión',
  legal_resolution: 'Resolución judicial',
  resolucion: 'Resolución judicial',
  consequence: 'Consecuencia',
  consecuencia: 'Consecuencia',
  quantified_group: 'Grupo cuantificado',
  infrastructure_asset: 'Infraestructura',
  infraestructura: 'Infraestructura',
  product: 'Producto',
  producto: 'Producto',
}

export const DOCUMENT_ROLE_LABELS: Record<string, string> = {
  initial_report: 'Reporte inicial',
  update: 'Actualización',
  official_confirmation: 'Confirmación oficial',
  consequence_report: 'Reporte de consecuencia',
  judicial_development: 'Desarrollo judicial',
  institutional_balance: 'Balance institucional',
  correction: 'Corrección',
  background: 'Antecedente',
  opinion: 'Opinión',
}

export function entityTypeLabel(type: string): string {
  const t = (type ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  return ENTITY_TYPE_LABELS[t] ?? ENTITY_TYPE_LABELS[type] ?? type
}

export function documentRoleLabel(role: string | null | undefined): string | null {
  if (!role) return null
  return DOCUMENT_ROLE_LABELS[role] ?? role
}

/** Etiquetas de métricas cuantitativas (español). */
export const METRIC_TYPE_LABELS: Record<string, string> = {
  affected_people: 'Personas afectadas',
  affected_families: 'Familias afectadas',
  disaster_affected_families: 'Familias damnificadas',
  evacuated_people: 'Personas evacuadas',
  sheltered_people: 'Personas albergadas',
  injured_people: 'Personas heridas',
  hospitalized_people: 'Personas hospitalizadas',
  deceased_people: 'Personas fallecidas',
  missing_people: 'Personas desaparecidas',
  emergencies_attended: 'Emergencias atendidas',
  homes_minor_damage: 'Viviendas con daño leve',
  homes_moderate_damage: 'Viviendas con daño moderado',
  homes_severe_damage: 'Viviendas con daño severo',
  homes_at_risk: 'Viviendas en riesgo',
  roads_affected: 'Carreteras afectadas',
  bridges_affected: 'Puentes afectados',
  bridges_destroyed: 'Puentes destruidos',
  schools_affected: 'Escuelas afectadas',
  public_buildings_affected: 'Edificios públicos afectados',
  energy_networks_affected: 'Redes de energía afectadas',
  floods: 'Inundaciones',
  landslides: 'Deslizamientos',
  mudflows: 'Flujos de lodo',
  structural_collapses: 'Colapsos estructurales',
  agricultural_damage_reports: 'Reportes de daño agrícola',
  other_quantified_impact: 'Otro impacto cuantificado',
}

const METRIC_GROUP_LABELS: Record<string, string> = {
  human: 'Impacto humano',
  housing: 'Vivienda',
  infrastructure: 'Infraestructura',
  emergency_type: 'Tipos de emergencia',
  other: 'Otras cifras',
}

/** Métricas destacadas para tarjetas numéricas. */
const HIGHLIGHTED_METRICS = new Set([
  'affected_people',
  'disaster_affected_families',
  'emergencies_attended',
  'deceased_people',
  'roads_affected',
  'schools_affected',
])

export function metricTypeLabel(metricType: string): string {
  return METRIC_TYPE_LABELS[metricType] ?? metricType
}

export function metricGroupLabel(group: string): string {
  return METRIC_GROUP_LABELS[group] ?? group
}

export function isHighlightedMetric(metricType: string): boolean {
  return HIGHLIGHTED_METRICS.has(metricType)
}

/** Grupo de dominio de una métrica. */
export function metricGroup(metricType: string): 'human' | 'housing' | 'infrastructure' | 'emergency_type' | 'other' {
  const t = (metricType ?? '').toLowerCase()
  if (/people|families|deceased|missing|injured|hospitalized|evacuated|sheltered|affected_famil/.test(t)) return 'human'
  if (/^homes_|vivienda/.test(t)) return 'housing'
  if (/roads|bridges|schools|public_buildings|energy|infra/.test(t)) return 'infrastructure'
  if (/floods|landslides|mudflows|structural_collapses|emergencies_attended/.test(t)) return 'emergency_type'
  return 'other'
}

/** Sensibilidad: preferir etiquetas específicas y humanizadas. */
export function sensitivitySpecificLabel(code: string): string {
  const map: Record<string, string> = {
    natural_disaster: 'Desastre natural',
    rainy_season_impact: 'Impacto por temporada lluviosa',
    fatality: 'Fallecimientos reportados',
    missing_persons: 'Personas desaparecidas',
    housing_damage: 'Daño habitacional',
    national_emergency: 'Emergencia nacional en evolución',
  }
  return map[code] ?? SENSITIVITY_FLAG_LABELS[code] ?? code
}

/** Grupo de presentación para separar actores, hechos, ubicación y procedencia. */
export function entityGroup(entityType: string): 'participants' | 'facts' | 'location' | 'source' | 'other' {
  const t = (entityType ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (/person|persona|jueza?|piloto|conductor|vehicul|vehicle|autobus|bus|product|producto|organizacion|organization|empresa|institu|ministerio/.test(t)) {
    return 'participants'
  }
  if (/event|hecho|accidente|decision|resolucion|resolution|consequence|consecuencia|fallecimiento|muerte/.test(t)) {
    return 'facts'
  }
  if (/lugar|place|ciudad|city|zona|territorio|municip|infra|carretera|ruta|via/.test(t)) {
    return 'location'
  }
  if (/fuente|source|prensa|medio|document_source/.test(t)) {
    return 'source'
  }
  return 'other'
}
