export const FIRE_FINDING_PROFILE = {
  entityType: 'fire_event',
  requiredContexts: ['protected_area', 'land_cover'] as const,
  optionalContexts: ['population', 'climate', 'biodiversity'] as const,
} as const

export type FireFindingRequiredContext = (typeof FIRE_FINDING_PROFILE.requiredContexts)[number]
export type FireFindingOptionalContext = (typeof FIRE_FINDING_PROFILE.optionalContexts)[number]
