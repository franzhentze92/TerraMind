/**
 * Environmental Event Framework — reusable finding rules.
 *
 * These generic rules are declared ONCE here and activated by id from any
 * manifest (`findingRuleIds`). Plugins never copy rule implementations.
 *
 * Rules that only need canonical fields (persistence, lifecycle, sources) run
 * generically. Rules that need territorial enrichment (population, roads,
 * cropland, protected areas, biodiversity) are declared as CONTRACTS here: they
 * evaluate to `matched: false` with a documented rationale until the enrichment
 * is wired generically, so thermal results never change. See DESIGN doc.
 */
import type {
  EnvironmentalContext,
  EnvironmentalFindingRule,
  FindingRuleCategory,
  FindingRuleResult,
} from '@/modules/environmental-events/contracts/finding-rule'
import type { EnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import { environmentalFindingRuleRegistry } from '@/modules/environmental-events/registry/finding-rule-registry'

export const REUSABLE_RULE_IDS = {
  nearPopulation: 'EVENT_NEAR_POPULATION',
  nearProtectedArea: 'EVENT_NEAR_PROTECTED_AREA',
  nearRoad: 'EVENT_NEAR_ROAD',
  insideCropland: 'EVENT_INSIDE_CROPLAND',
  withBiodiversity: 'EVENT_WITH_BIODIVERSITY_CONTEXT',
  expanding: 'EVENT_EXPANDING',
  persistent: 'EVENT_PERSISTENT',
  multipleSources: 'MULTIPLE_SOURCES_AGREE',
} as const

const ALL_TYPES: EnvironmentalEventType[] = ['thermal_activity', 'flood']

function rule(
  id: string,
  category: FindingRuleCategory,
  evaluate: (
    event: EnvironmentalEvent,
    context: EnvironmentalContext,
  ) => FindingRuleResult | null,
): EnvironmentalFindingRule {
  return {
    id,
    category,
    supportedEventTypes: ALL_TYPES,
    async evaluate(event, context) {
      return evaluate(event, context)
    },
  }
}

/** Contract-only rule: needs generic territorial enrichment (pending). */
function contractRule(id: string, title: string, pendingLayer: string): EnvironmentalFindingRule {
  return rule(id, 'reusable', () => ({
    ruleId: id,
    matched: false,
    title,
    rationale: `Contrato genérico pendiente de enriquecimiento territorial (${pendingLayer}); no altera resultados actuales.`,
  }))
}

export const reusableFindingRules: EnvironmentalFindingRule[] = [
  contractRule(REUSABLE_RULE_IDS.nearPopulation, 'Evento próximo a población', 'population'),
  contractRule(REUSABLE_RULE_IDS.nearProtectedArea, 'Evento en o próximo a área protegida', 'protected_areas'),
  contractRule(REUSABLE_RULE_IDS.nearRoad, 'Evento próximo a carreteras', 'roads'),
  contractRule(REUSABLE_RULE_IDS.insideCropland, 'Evento dentro de cobertura agrícola', 'cropland'),
  contractRule(REUSABLE_RULE_IDS.withBiodiversity, 'Contexto de biodiversidad', 'biodiversity'),
  rule(REUSABLE_RULE_IDS.expanding, 'reusable', (event) => ({
    ruleId: REUSABLE_RULE_IDS.expanding,
    matched: event.lifecycleState === 'expanding' || event.trend?.direction === 'rising',
    title: 'Expansión',
    rationale:
      event.lifecycleState === 'expanding' || event.trend?.direction === 'rising'
        ? 'El evento muestra expansión en la ventana observada.'
        : 'Sin señales de expansión en la ventana observada.',
  })),
  rule(REUSABLE_RULE_IDS.persistent, 'reusable', (event) => ({
    ruleId: REUSABLE_RULE_IDS.persistent,
    matched: (event.persistence ?? 0) >= 12,
    title: 'Persistencia creciente',
    rationale: `Persistencia de ${(event.persistence ?? 0).toFixed(1)} h.`,
  })),
  rule(REUSABLE_RULE_IDS.multipleSources, 'reusable', (event) => ({
    ruleId: REUSABLE_RULE_IDS.multipleSources,
    matched: event.sourceIds.length > 1,
    title: 'Múltiples fuentes coincidentes',
    rationale: `Observado por ${event.sourceIds.length} fuentes.`,
  })),
]

let registered = false

export function registerReusableFindingRules(): void {
  if (registered) return
  for (const r of reusableFindingRules) {
    if (!environmentalFindingRuleRegistry.get(r.id)) {
      environmentalFindingRuleRegistry.register(r)
    }
  }
  registered = true
}
