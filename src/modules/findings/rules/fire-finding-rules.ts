import {
  FIRE_FINDING_CONFIG,
  NATURAL_LAND_COVER_CLASSES,
} from '../config/fire-finding.config'
import type {
  FindingConfidence,
  FindingRuleResult,
  FireFindingType,
} from '../findings.types'
import type { FireFindingEvaluationContext } from '../services/fire-finding-context.loader'
import { PROTECTED_AREAS_SOURCE_NAME } from '@/modules/fires/config/fire.constants'
import { CLIMATE_FIRE_SOURCE_PROVIDER } from '@/modules/fires/config/climate.constants'
import { landCoverDisplayLabel } from '@/modules/territory/land-cover/land-cover-taxonomy'

const BASE_LIMITATIONS = [
  'La detección térmica no confirma un incendio.',
]

function confidence(
  level: FindingConfidence['level'],
  reasons: string[],
): FindingConfidence {
  return { level, reasons }
}

function notEvaluable(
  code: string,
  findingType: FireFindingType,
  reason: string,
): FindingRuleResult {
  return {
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: findingType,
    status: 'not_evaluable',
    title: '',
    summary: '',
    severity_label: 'informational',
    confidence: confidence('insufficient', [reason]),
    evidence: [],
    limitations: [],
    recommended_actions: [],
    source_domains: [],
  }
}

function notTriggered(
  code: string,
  findingType: FireFindingType,
): FindingRuleResult {
  return {
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: findingType,
    status: 'not_triggered',
    title: '',
    summary: '',
    severity_label: 'informational',
    confidence: confidence('insufficient', []),
    evidence: [],
    limitations: [],
    recommended_actions: [],
    source_domains: [],
  }
}

function triggered(input: Omit<FindingRuleResult, 'status'>): FindingRuleResult {
  return { ...input, status: 'triggered' }
}

function landCoverZone(ctx: FireFindingEvaluationContext) {
  return ctx.land_cover?.zones?.[0] ?? ctx.land_cover?.zones?.at(-1)
}

function populationZone1km(ctx: FireFindingEvaluationContext) {
  return ctx.population?.zones.find((z) => z.radius_m === 1000) ?? ctx.population?.zones[0]
}

function biodiversityLargest(ctx: FireFindingEvaluationContext) {
  const zones = ctx.biodiversity?.zones ?? []
  return zones[zones.length - 1]
}

export function evaluateThermalInProtectedArea(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult {
  const type: FireFindingType = 'thermal_activity_in_protected_area'
  const code = 'THERMAL_PROTECTED_AREA_001'

  if (!ctx.protected_area) {
    return notEvaluable(code, type, 'Contexto de área protegida no disponible')
  }
  if (ctx.event.detection_count < 1) {
    return notEvaluable(code, type, 'Sin detecciones térmicas válidas')
  }
  if (!ctx.protected_area.inside_protected_area) {
    return notTriggered(code, type)
  }

  const areaName =
    ctx.protected_area.intersecting_areas[0]?.display_name ?? 'área protegida'

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Actividad térmica dentro de área protegida',
    summary: `Actividad térmica detectada dentro de un área protegida (${areaName}).`,
    severity_label: 'elevated_attention',
    confidence: confidence(
      ctx.protected_area.status === 'complete' ? 'high' : 'moderate',
      ctx.protected_area.status === 'partial' ? ['protected_area_context_partial'] : [],
    ),
    evidence: [
      {
        evidence_code: 'protected_area_relation',
        domain: 'protected_areas',
        label: 'Relación con área protegida',
        value: 'inside',
        source: PROTECTED_AREAS_SOURCE_NAME,
        quality: 'official',
        context_path: 'protected_area_context.inside_protected_area',
      },
      {
        evidence_code: 'detection_count',
        domain: 'fire_events',
        label: 'Detecciones térmicas',
        value: ctx.event.detection_count,
        source: 'NASA FIRMS',
        quality: 'derived',
        context_path: 'event.detection_count',
      },
    ],
    limitations: [...BASE_LIMITATIONS],
    recommended_actions: [
      'Verificar el evento con información adicional.',
      'Contactar autoridad territorial competente si procede.',
      'Mantener seguimiento por ubicación en área protegida.',
    ],
    source_domains: ['fire_events', 'protected_areas'],
  })
}

export function evaluateThermalNearProtectedArea(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult {
  const type: FireFindingType = 'thermal_activity_near_protected_area'
  const code = 'THERMAL_PROTECTED_AREA_002'

  if (!ctx.protected_area) {
    return notEvaluable(code, type, 'Contexto de área protegida no disponible')
  }
  if (ctx.protected_area.inside_protected_area) {
    return notTriggered(code, type)
  }

  const distance = ctx.protected_area.nearest_area?.distance_m
  if (distance == null || distance > FIRE_FINDING_CONFIG.nearProtectedAreaThresholdM) {
    return notTriggered(code, type)
  }

  const areaName = ctx.protected_area.nearest_area?.display_name ?? 'área protegida cercana'

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Actividad térmica cerca de área protegida',
    summary: `Actividad térmica detectada a ${Math.round(distance)} m de ${areaName}.`,
    severity_label: 'attention',
    confidence: confidence('moderate', ['proximity_derived']),
    evidence: [
      {
        evidence_code: 'nearest_protected_distance_m',
        domain: 'protected_areas',
        label: 'Distancia al área protegida más cercana',
        value: Math.round(distance),
        unit: 'm',
        source: PROTECTED_AREAS_SOURCE_NAME,
        quality: 'official',
        context_path: 'protected_area_context.nearest_area.distance_m',
      },
    ],
    limitations: [...BASE_LIMITATIONS],
    recommended_actions: [
      'Revisar evolución de nuevas detecciones.',
      'Verificar proximidad territorial con fuente oficial.',
    ],
    source_domains: ['fire_events', 'protected_areas'],
  })
}

export function evaluateThermalOnForestCover(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult {
  const type: FireFindingType = 'thermal_activity_on_forest_cover'
  const code = 'THERMAL_LAND_COVER_001'

  if (!ctx.land_cover) {
    return notEvaluable(code, type, 'Contexto de cobertura del suelo no disponible')
  }

  const zone = landCoverZone(ctx)
  const forestPct =
    zone?.class_distribution.find((c) => c.class === 'forest')?.percentage ?? 0

  if (forestPct < FIRE_FINDING_CONFIG.forestDominancePct) {
    return notTriggered(code, type)
  }

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Actividad térmica sobre cobertura forestal',
    summary: `Las detecciones se ubican principalmente sobre cobertura forestal según ESA WorldCover 2021 (${forestPct.toFixed(0)}% en el radio analizado).`,
    severity_label: 'attention',
    confidence: confidence(ctx.land_cover.status === 'complete' ? 'high' : 'moderate', []),
    evidence: [
      {
        evidence_code: 'forest_cover_pct',
        domain: 'land_cover',
        label: 'Porcentaje de bosque',
        value: Math.round(forestPct),
        unit: '%',
        source: 'ESA WorldCover 2021',
        quality: 'modelled',
        context_path: 'land_cover_context.zones[0].class_distribution.forest',
      },
      {
        evidence_code: 'dominant_class',
        domain: 'land_cover',
        label: 'Clase dominante',
        value: landCoverDisplayLabel(zone?.dominant_class),
        source: 'ESA WorldCover 2021',
        quality: 'modelled',
        context_path: 'land_cover_context.zones[0].dominant_class',
      },
    ],
    limitations: [
      ...BASE_LIMITATIONS,
      'La cobertura del suelo corresponde a ESA WorldCover 2021.',
    ],
    recommended_actions: ['Verificar el evento con información adicional.'],
    source_domains: ['fire_events', 'land_cover'],
  })
}

export function evaluateThermalMixedNaturalCover(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult {
  const type: FireFindingType = 'thermal_activity_in_mixed_natural_cover'
  const code = 'THERMAL_LAND_COVER_002'

  if (!ctx.land_cover) {
    return notEvaluable(code, type, 'Contexto de cobertura del suelo no disponible')
  }

  const zone = landCoverZone(ctx)
  const naturalPct = (zone?.class_distribution ?? [])
    .filter((c) => NATURAL_LAND_COVER_CLASSES.has(c.class))
    .reduce((sum, c) => sum + c.percentage, 0)

  if (naturalPct < FIRE_FINDING_CONFIG.mixedNaturalPct) {
    return notTriggered(code, type)
  }

  const classes = (zone?.class_distribution ?? [])
    .filter((c) => NATURAL_LAND_COVER_CLASSES.has(c.class) && c.percentage > 5)
    .map((c) => landCoverDisplayLabel(c.class))
    .join(', ')

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Actividad térmica en cobertura natural mixta',
    summary: `Las detecciones se ubican en cobertura natural mixta (${classes || 'varias clases naturales'}).`,
    severity_label: 'informational',
    confidence: confidence('moderate', []),
    evidence: [
      {
        evidence_code: 'natural_cover_pct',
        domain: 'land_cover',
        label: 'Cobertura natural combinada',
        value: Math.round(naturalPct),
        unit: '%',
        source: 'ESA WorldCover 2021',
        quality: 'modelled',
        context_path: 'land_cover_context.zones',
      },
    ],
    limitations: [
      ...BASE_LIMITATIONS,
      'No se afirma daño ni afectación confirmada.',
    ],
    recommended_actions: ['Revisar evolución de nuevas detecciones.'],
    source_domains: ['fire_events', 'land_cover'],
  })
}

export function evaluateDryConditions(ctx: FireFindingEvaluationContext): FindingRuleResult {
  const type: FireFindingType = 'dry_conditions_around_thermal_event'
  const code = 'THERMAL_CLIMATE_001'

  if (!ctx.climate) {
    return notEvaluable(code, type, 'Contexto climático no disponible')
  }

  const precip24 = ctx.climate.antecedent.precipitation_previous_24h_mm
  const dryDays = ctx.climate.antecedent.dry_days_consecutive
  const humidity = ctx.climate.event_conditions.relative_humidity_pct?.mean
  const forecast24 = ctx.climate.forecast.precipitation_next_24h_mm

  const drySignals = [
    precip24 != null && precip24 < FIRE_FINDING_CONFIG.dryPrecip24hMm,
    dryDays != null && dryDays >= FIRE_FINDING_CONFIG.dryDaysConsecutive,
    humidity != null && humidity < FIRE_FINDING_CONFIG.lowHumidityPct,
    forecast24 != null && forecast24 < FIRE_FINDING_CONFIG.dryPrecip24hMm,
  ].filter(Boolean).length

  if (drySignals < 2) {
    return notTriggered(code, type)
  }

  const reasons: string[] = []
  if (ctx.climate.status === 'partial') reasons.push('climate_context_partial')

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Condiciones secas en el entorno del evento',
    summary:
      'Las condiciones meteorológicas modeladas muestran baja precipitación previa y/o humedad relativa reducida en el entorno del evento.',
    severity_label: 'attention',
    confidence: confidence(ctx.climate.status === 'complete' ? 'moderate' : 'low', reasons),
    evidence: [
      {
        evidence_code: 'precip_24h_mm',
        domain: 'climate',
        label: 'Precipitación previa 24 h',
        value: precip24,
        unit: 'mm',
        source: CLIMATE_FIRE_SOURCE_PROVIDER,
        quality: 'modelled',
        context_path: 'climate_context.antecedent.precipitation_previous_24h_mm',
      },
      {
        evidence_code: 'dry_days_consecutive',
        domain: 'climate',
        label: 'Días secos consecutivos',
        value: dryDays,
        source: CLIMATE_FIRE_SOURCE_PROVIDER,
        quality: 'modelled',
        context_path: 'climate_context.antecedent.dry_days_consecutive',
      },
    ],
    limitations: [
      ...BASE_LIMITATIONS,
      'La información climática es modelada.',
    ],
    recommended_actions: ['Revisar condiciones meteorológicas próximas.'],
    source_domains: ['fire_events', 'climate'],
  })
}

export function evaluateStrongWind(ctx: FireFindingEvaluationContext): FindingRuleResult {
  const type: FireFindingType = 'strong_wind_during_thermal_event'
  const code = 'THERMAL_CLIMATE_002'

  if (!ctx.climate) {
    return notEvaluable(code, type, 'Contexto climático no disponible')
  }

  const wind = ctx.climate.event_conditions.wind_speed_kmh?.mean
  const gust = ctx.climate.event_conditions.wind_gust_kmh?.max

  const strong =
    (wind != null && wind >= FIRE_FINDING_CONFIG.strongWindKmh) ||
    (gust != null && gust >= FIRE_FINDING_CONFIG.strongGustKmh)

  if (!strong) return notTriggered(code, type)

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Viento elevado durante la detección',
    summary: `Se registraron condiciones de viento elevado en el momento modelado de la detección (viento ${wind?.toFixed(0) ?? '—'} km/h).`,
    severity_label: 'informational',
    confidence: confidence('moderate', []),
    evidence: [
      {
        evidence_code: 'wind_speed_kmh',
        domain: 'climate',
        label: 'Viento medio',
        value: wind ?? null,
        unit: 'km/h',
        source: CLIMATE_FIRE_SOURCE_PROVIDER,
        quality: 'modelled',
        context_path: 'climate_context.event_conditions.wind_speed_kmh',
      },
    ],
    limitations: [
      ...BASE_LIMITATIONS,
      'No se afirma propagación ni comportamiento del fuego.',
      'La información climática es modelada.',
    ],
    recommended_actions: ['Revisar condiciones meteorológicas próximas.'],
    source_domains: ['fire_events', 'climate'],
  })
}

export function evaluateReliablePopulation(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult {
  const type: FireFindingType = 'nearby_population_with_reliable_estimate'
  const code = 'THERMAL_POPULATION_001'

  if (!ctx.population) {
    return notEvaluable(code, type, 'Contexto poblacional no disponible')
  }

  const zone = populationZone1km(ctx)
  const conf = zone?.confidence?.level
  const pop = zone?.estimated_population ?? 0

  if (!zone || !conf || !['high', 'moderate'].includes(conf)) {
    return notTriggered(code, type)
  }
  if (pop < FIRE_FINDING_CONFIG.populationReliableThreshold) {
    return notTriggered(code, type)
  }

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Población modelada en el entorno inmediato',
    summary: `Existe población residente modelada en el entorno del evento (estimación ~${Math.round(pop)} personas en 1 km, confianza ${conf}).`,
    severity_label: 'attention',
    confidence: confidence(conf === 'high' ? 'moderate' : 'low', ['population_modelled']),
    evidence: [
      {
        evidence_code: 'population_1km',
        domain: 'population',
        label: 'Población estimada 1 km',
        value: Math.round(pop),
        source: 'WorldPop',
        quality: 'modelled',
        context_path: 'population_context.zones[radius_m=1000].estimated_population',
      },
    ],
    limitations: [
      ...BASE_LIMITATIONS,
      'La población es una estimación espacial modelada.',
      'El rango poblacional no constituye un intervalo estadístico.',
    ],
    recommended_actions: ['Verificar presencia de comunidades o infraestructura.'],
    source_domains: ['fire_events', 'population'],
  })
}

export function evaluateUncertainPopulation(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult {
  const type: FireFindingType = 'nearby_population_with_high_uncertainty'
  const code = 'THERMAL_POPULATION_002'

  if (!ctx.population) {
    return notEvaluable(code, type, 'Contexto poblacional no disponible')
  }

  const zone = populationZone1km(ctx)
  const conf = zone?.confidence?.level
  if (!zone || !conf || !['low', 'very_low'].includes(conf)) {
    return notTriggered(code, type)
  }

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Alta incertidumbre en estimación poblacional local',
    summary:
      'Los modelos de población presentan alta divergencia o incertidumbre local; la estimación debe interpretarse con cautela.',
    severity_label: 'informational',
    confidence: confidence('low', ['population_high_uncertainty']),
    evidence: [
      {
        evidence_code: 'population_confidence',
        domain: 'population',
        label: 'Confianza de estimación 1 km',
        value: conf,
        source: 'WorldPop',
        quality: 'modelled',
        context_path: 'population_context.zones[radius_m=1000].confidence.level',
      },
    ],
    limitations: [
      ...BASE_LIMITATIONS,
      'La población es una estimación espacial modelada.',
      'La incertidumbre no constituye medida de exposición.',
    ],
    recommended_actions: ['Verificar presencia de comunidades con fuentes locales.'],
    source_domains: ['fire_events', 'population'],
  })
}

export function evaluateDocumentedBiodiversity(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult {
  const type: FireFindingType = 'documented_biodiversity_near_event'
  const code = 'THERMAL_BIODIVERSITY_001'

  if (!ctx.biodiversity) {
    return notEvaluable(code, type, 'Contexto de biodiversidad no disponible')
  }

  const zone = biodiversityLargest(ctx)
  const species = zone?.unique_species_documented ?? 0
  const quality = ctx.biodiversity.summary.quality.level

  if (species <= 0 || quality === 'very_limited') {
    return notTriggered(code, type)
  }

  const limitations = [
    ...BASE_LIMITATIONS,
    'Los registros de biodiversidad no confirman presencia durante el evento.',
  ]
  if (ctx.biodiversity.provider_status.inaturalist === 'error') {
    limitations.push('iNaturalist no estuvo disponible durante esta evaluación.')
  }

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Biodiversidad documentada en el entorno',
    summary: `En el entorno del evento existe biodiversidad documentada (${species} especie(s) en ${(zone?.radius_m ?? 10_000) / 1000} km), sin que esto confirme afectación.`,
    severity_label: 'informational',
    confidence: confidence(
      quality === 'high' ? 'moderate' : quality === 'moderate' ? 'low' : 'low',
      [],
    ),
    evidence: [
      {
        evidence_code: 'species_documented',
        domain: 'biodiversity',
        label: 'Especies documentadas',
        value: species,
        source: 'GBIF / iNaturalist',
        quality: 'documented',
        context_path: 'biodiversity_context.summary.unique_species_documented',
      },
    ],
    limitations,
    recommended_actions: ['Mantener seguimiento del contexto ecológico documentado.'],
    source_domains: ['fire_events', 'biodiversity'],
  })
}

export function evaluateBiodiversityLimited(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult {
  const type: FireFindingType = 'biodiversity_context_limited'
  const code = 'THERMAL_BIODIVERSITY_002'

  if (!ctx.biodiversity) {
    return notEvaluable(code, type, 'Contexto de biodiversidad no disponible')
  }

  const reasons = ctx.biodiversity.summary.quality.reasons
  const limited =
    ctx.biodiversity.status === 'partial' ||
    ctx.biodiversity.summary.quality.level === 'very_limited' ||
    ctx.biodiversity.summary.quality.level === 'limited' ||
    reasons.length > 0

  if (!limited) return notTriggered(code, type)

  const limitations = [
    'Los registros de biodiversidad no confirman presencia durante el evento.',
  ]
  if (ctx.biodiversity.provider_status.inaturalist === 'error') {
    limitations.push('iNaturalist no estuvo disponible durante esta evaluación.')
  }
  if (reasons.includes('sample_truncated')) {
    limitations.push('La muestra de biodiversidad puede estar truncada.')
  }

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Contexto de biodiversidad con limitaciones',
    summary:
      'El contexto de biodiversidad documentada presenta limitaciones de cobertura, precisión o disponibilidad de fuentes.',
    severity_label: 'informational',
    confidence: confidence('low', reasons.map(String)),
    evidence: [
      {
        evidence_code: 'biodiversity_quality',
        domain: 'biodiversity',
        label: 'Calidad del contexto',
        value: ctx.biodiversity.summary.quality.level,
        source: 'GBIF / iNaturalist',
        quality: 'documented',
        context_path: 'biodiversity_context.summary.quality',
      },
    ],
    limitations,
    recommended_actions: ['Interpretar la biodiversidad documentada con las limitaciones indicadas.'],
    source_domains: ['biodiversity'],
  })
}

export function evaluateMultiContextAttention(
  _ctx: FireFindingEvaluationContext,
  priorResults: FindingRuleResult[],
): FindingRuleResult {
  const type: FireFindingType = 'multi_context_attention'
  const code = 'THERMAL_MULTI_001'

  const contributing = priorResults.filter(
    (r) =>
      r.status === 'triggered' &&
      [
        'thermal_activity_in_protected_area',
        'thermal_activity_on_forest_cover',
        'dry_conditions_around_thermal_event',
        'documented_biodiversity_near_event',
      ].includes(r.finding_type),
  )

  if (contributing.length < FIRE_FINDING_CONFIG.multiContextMinRules) {
    return notTriggered(code, type)
  }

  const parts = contributing.map((r) => r.title.toLowerCase())
  const summary = `Coinciden múltiples contextos relevantes: ${parts.join('; ')}. No constituye confirmación de impacto ni situación de urgencia.`

  return triggered({
    rule_code: code,
    rule_version: '1.0.0',
    finding_type: type,
    title: 'Múltiples contextos requieren atención conjunta',
    summary,
    severity_label: 'elevated_attention',
    confidence: confidence('moderate', ['multi_context_composite']),
    evidence: contributing.flatMap((r) => r.evidence).slice(0, 8),
    limitations: [
      ...BASE_LIMITATIONS,
      'La combinación de contextos no confirma causalidad ni impacto.',
    ],
    recommended_actions: [
      'Verificar el evento con información adicional.',
      'Revisar evolución de nuevas detecciones.',
      'Mantener seguimiento integrado de contextos territoriales y ambientales.',
    ],
    source_domains: [...new Set(contributing.flatMap((r) => r.source_domains))],
  })
}

export const FIRE_FINDING_RULE_EVALUATORS = [
  evaluateThermalInProtectedArea,
  evaluateThermalNearProtectedArea,
  evaluateThermalOnForestCover,
  evaluateThermalMixedNaturalCover,
  evaluateDryConditions,
  evaluateStrongWind,
  evaluateReliablePopulation,
  evaluateUncertainPopulation,
  evaluateDocumentedBiodiversity,
  evaluateBiodiversityLimited,
] as const

export function evaluateAllFireFindingRules(
  ctx: FireFindingEvaluationContext,
): FindingRuleResult[] {
  const results = FIRE_FINDING_RULE_EVALUATORS.map((fn) => fn(ctx))
  results.push(evaluateMultiContextAttention(ctx, results))
  return results
}
