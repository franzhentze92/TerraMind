/**
 * Environmental Event Framework — thermal finding rules (descriptors).
 *
 * Classifies existing finding concerns as reusable vs type-specific. These
 * descriptors register the rules in the framework; they DO NOT migrate or
 * replace the Composite Finding Engine, which remains the authority for actual
 * finding generation. Rules evaluate against canonical event attributes only.
 */
import type {
  EnvironmentalFindingRule,
  FindingRuleResult,
} from '@/modules/environmental-events/contracts/finding-rule'
import type { ThermalEnvironmentalEvent } from '@/modules/environmental-events/types/environmental-event.types'

function makeRule(
  id: string,
  category: 'reusable' | 'type_specific',
  title: string,
  matcher: (event: ThermalEnvironmentalEvent) => { matched: boolean; rationale: string },
): EnvironmentalFindingRule<ThermalEnvironmentalEvent> {
  return {
    id,
    category,
    supportedEventTypes: ['thermal_activity'],
    async evaluate(event): Promise<FindingRuleResult | null> {
      const { matched, rationale } = matcher(event)
      return { ruleId: id, matched, title, rationale }
    },
  }
}

/** Reusable rules — applicable to future event types with adapters. */
export const reusableThermalFindingRules: EnvironmentalFindingRule<ThermalEnvironmentalEvent>[] = [
  makeRule('growing_persistence', 'reusable', 'Persistencia creciente', (e) => ({
    matched: (e.persistence ?? 0) >= 12,
    rationale: `Persistencia de ${(e.persistence ?? 0).toFixed(1)} h.`,
  })),
  makeRule('multiple_sources', 'reusable', 'Múltiples fuentes coincidentes', (e) => ({
    matched: e.attributes.satelliteCount > 1,
    rationale: `Observado por ${e.attributes.satelliteCount} fuentes.`,
  })),
]

/** Type-specific rules — thermal only. */
export const thermalSpecificFindingRules: EnvironmentalFindingRule<ThermalEnvironmentalEvent>[] = [
  makeRule('thermal_frp', 'type_specific', 'Energía radiativa elevada', (e) => ({
    matched: (e.attributes.maxFrp ?? 0) >= 50,
    rationale: `Energía radiativa máxima de ${(e.attributes.maxFrp ?? 0).toFixed(2)} MW.`,
  })),
  makeRule('thermal_satellite_count', 'type_specific', 'Confirmación multi-satélite', (e) => ({
    matched: e.attributes.satelliteCount >= 2,
    rationale: `${e.attributes.satelliteCount} satélites contribuyen al evento.`,
  })),
]

export const thermalFindingRules: EnvironmentalFindingRule<ThermalEnvironmentalEvent>[] = [
  ...reusableThermalFindingRules,
  ...thermalSpecificFindingRules,
]
