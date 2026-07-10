import type { FireFindingType } from '@/modules/findings/findings.types'
import type {
  ActionLevel,
  AttentionLevel,
  VerificationLevel,
} from '@/modules/priorities/priorities.types'

export const FIRE_PRIORITY_MODEL_VERSION = '1.0.0'
export const FIRE_PRIORITY_FINDINGS_RULE_SET = '1.0.0'
export const FIRE_PRIORITY_VALIDITY_HOURS = 6

export const DOMAIN_CAPS: Record<string, number> = {
  protected_areas: 20,
  land_cover: 20,
  climate: 20,
  population: 20,
  biodiversity: 10,
  persistence: 10,
  composite: 8,
}

export interface FindingWeightConfig {
  domain: string
  severity?: number
  urgency?: number
  exposure?: number
  sensitivity?: number
  verification?: number
  derived?: boolean
  concurrency_bonus?: number
}

export const FINDING_WEIGHTS: Record<FireFindingType, FindingWeightConfig> = {
  thermal_activity_in_protected_area: {
    domain: 'protected_areas',
    severity: 18,
    sensitivity: 16,
    urgency: 4,
  },
  thermal_activity_near_protected_area: {
    domain: 'protected_areas',
    severity: 10,
    sensitivity: 10,
    urgency: 2,
  },
  thermal_activity_on_forest_cover: {
    domain: 'land_cover',
    severity: 14,
    sensitivity: 12,
  },
  thermal_activity_in_mixed_natural_cover: {
    domain: 'land_cover',
    severity: 8,
    sensitivity: 8,
  },
  dry_conditions_around_thermal_event: {
    domain: 'climate',
    severity: 6,
    urgency: 12,
  },
  strong_wind_during_thermal_event: {
    domain: 'climate',
    severity: 4,
    urgency: 10,
  },
  nearby_population_with_reliable_estimate: {
    domain: 'population',
    exposure: 14,
    severity: 4,
  },
  nearby_population_with_high_uncertainty: {
    domain: 'population',
    verification: 16,
  },
  documented_biodiversity_near_event: {
    domain: 'biodiversity',
    sensitivity: 8,
    exposure: 4,
  },
  biodiversity_context_limited: {
    domain: 'biodiversity',
    verification: 10,
  },
  multi_context_attention: {
    domain: 'composite',
    derived: true,
    concurrency_bonus: 8,
  },
}

export const SUBSTITUTION_RULES: Array<{ dominant: FireFindingType; subsumed: FireFindingType }> = [
  {
    dominant: 'thermal_activity_in_protected_area',
    subsumed: 'thermal_activity_near_protected_area',
  },
  {
    dominant: 'thermal_activity_on_forest_cover',
    subsumed: 'thermal_activity_in_mixed_natural_cover',
  },
]

export const ATTENTION_THRESHOLDS: Record<AttentionLevel, number> = {
  routine: 0,
  monitor: 25,
  review: 45,
  high_attention: 60,
  priority_attention: 75,
}

export const VERIFICATION_THRESHOLDS: Record<VerificationLevel, number> = {
  not_required: 0,
  useful: 20,
  recommended: 40,
  high_priority: 60,
}

export const ACTION_THRESHOLDS: Record<ActionLevel, number> = {
  none: 0,
  prepare: 25,
  coordinate: 45,
  operational_attention: 65,
}

export const THERMAL_DECAY_CONFIG = {
  profile: 'thermal_fast',
  half_life_hours: 12,
  max_decay_points: 25,
}

export const EVENT_STATUS_URGENCY: Record<string, number> = {
  new: 8,
  active: 14,
  monitoring: 6,
  closed: 0,
}

export const PERSISTENCE_BONUS = {
  per_hour: 0.5,
  max: 10,
  per_detection: 0.3,
  detection_max: 6,
}

export const CONFIDENCE_MODIFIERS: Record<string, number> = {
  high: 1.0,
  moderate: 0.9,
  low: 0.78,
  insufficient: 0.65,
}

export const ACTION_CAP_UNCONFIRMED_FIRE = 55
