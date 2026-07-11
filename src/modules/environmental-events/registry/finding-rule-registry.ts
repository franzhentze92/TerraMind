/**
 * Environmental Event Framework — finding rule registry.
 *
 * Indexes finding rules by id and by supported event type. Rules are registered
 * as descriptors/adapters; this does not migrate the Composite Finding Engine.
 */
import type { EnvironmentalEventType } from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalFindingRule } from '@/modules/environmental-events/contracts/finding-rule'

export class FindingRuleRegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FindingRuleRegistryError'
  }
}

export class EnvironmentalFindingRuleRegistry {
  private readonly rules = new Map<string, EnvironmentalFindingRule>()

  register(rule: EnvironmentalFindingRule): void {
    if (this.rules.has(rule.id)) {
      throw new FindingRuleRegistryError(`Regla de hallazgo duplicada: "${rule.id}"`)
    }
    this.rules.set(rule.id, rule)
  }

  registerMany(rules: EnvironmentalFindingRule[]): void {
    for (const rule of rules) this.register(rule)
  }

  get(id: string): EnvironmentalFindingRule | undefined {
    return this.rules.get(id)
  }

  forEventType(type: EnvironmentalEventType): EnvironmentalFindingRule[] {
    return [...this.rules.values()].filter((r) =>
      r.supportedEventTypes.includes(type),
    )
  }

  list(): EnvironmentalFindingRule[] {
    return [...this.rules.values()]
  }

  clear(): void {
    this.rules.clear()
  }
}

export const environmentalFindingRuleRegistry = new EnvironmentalFindingRuleRegistry()
