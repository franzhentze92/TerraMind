/**
 * Environmental Event Framework — manifest-driven registry.
 *
 * A single manifest per type is registered here. Everything else (generic API,
 * Situación Nacional, reports, map, UI) reads from this one registry, so a new
 * event type never requires editing multiple registries.
 *
 * Runtime visibility is gated: disabled types (feature flag off) are registered
 * for structural validation and tests but hidden from runtime consumers.
 */
import type {
  EnvironmentalEventType,
  EnvironmentalGeometryKind,
} from '@/modules/environmental-events/types/taxonomy'
import type { ObservationSourceDescriptor } from '@/modules/environmental-events/types/observation.types'
import type { EnvironmentalEventPresentationAdapter } from '@/modules/environmental-events/contracts/presentation'
import type { EnvironmentalEventMapRenderer } from '@/modules/environmental-events/contracts/map-renderer'
import type { EventPriorityFactorProvider } from '@/modules/environmental-events/contracts/priority-provider'
import type { EnvironmentalFindingRule } from '@/modules/environmental-events/contracts/finding-rule'
import type { EventReportAdapter } from '@/modules/environmental-events/contracts/report-adapter'
import type { EnvironmentalEventManifest } from '@/modules/environmental-events/manifest/event-manifest'
import { NEUTRAL_ACCENT_COLOR } from '@/modules/environmental-events/manifest/event-manifest'
import { environmentalFindingRuleRegistry } from '@/modules/environmental-events/registry/finding-rule-registry'

/** Back-compat alias: a definition IS a manifest. */
export type EnvironmentalEventDefinition = EnvironmentalEventManifest

export class RegistryError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RegistryError'
  }
}

function flagEnvName(flag: string): string {
  return `EVENT_FLAG_${flag.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
}

export class EnvironmentalEventRegistry {
  private readonly manifests = new Map<EnvironmentalEventType, EnvironmentalEventManifest>()
  /** Test-only override to include disabled types in runtime queries. */
  private includeDisabled = false

  registerManifest(manifest: EnvironmentalEventManifest): void {
    if (this.manifests.has(manifest.type)) {
      throw new RegistryError(`Tipo de evento duplicado: "${manifest.type}"`)
    }
    this.manifests.set(manifest.type, manifest)
    // Type-specific rules become part of the single finding-rule registry.
    for (const rule of manifest.typeSpecificFindingRules) {
      if (!environmentalFindingRuleRegistry.get(rule.id)) {
        environmentalFindingRuleRegistry.register(rule)
      }
    }
  }

  /** @deprecated use registerManifest */
  register(manifest: EnvironmentalEventManifest): void {
    this.registerManifest(manifest)
  }

  setIncludeDisabled(value: boolean): void {
    this.includeDisabled = value
  }

  isEnabled(type: EnvironmentalEventType): boolean {
    const manifest = this.manifests.get(type)
    if (!manifest) return false
    if (manifest.runtime.enabledByDefault) return true
    if (this.includeDisabled) return true
    if (typeof process !== 'undefined' && process.env) {
      const value = process.env[flagEnvName(manifest.runtime.featureFlag)]
      if (value && value !== '0' && value !== 'false') return true
    }
    return false
  }

  has(type: EnvironmentalEventType): boolean {
    return this.manifests.has(type)
  }

  get(type: EnvironmentalEventType): EnvironmentalEventManifest {
    const manifest = this.manifests.get(type)
    if (!manifest) throw new RegistryError(`Tipo de evento no registrado: "${type}"`)
    return manifest
  }

  tryGet(type: EnvironmentalEventType): EnvironmentalEventManifest | undefined {
    return this.manifests.get(type)
  }

  /** All manifests, including disabled ones (structural view). */
  list(): EnvironmentalEventManifest[] {
    return [...this.manifests.values()]
  }

  /** Manifests visible at runtime (enabled only). */
  listEnabled(): EnvironmentalEventManifest[] {
    return this.list().filter((m) => this.isEnabled(m.type))
  }

  registeredTypes(): EnvironmentalEventType[] {
    return [...this.manifests.keys()]
  }

  enabledTypes(): EnvironmentalEventType[] {
    return this.listEnabled().map((m) => m.type)
  }

  getLabel(type: EnvironmentalEventType): string {
    return this.get(type).label
  }

  getIcon(type: EnvironmentalEventType): string {
    return this.get(type).icon
  }

  /** Canonical accent color for the type, with neutral fallback. Single source of truth. */
  getAccentColor(type: EnvironmentalEventType): string {
    return this.get(type).accentColor ?? NEUTRAL_ACCENT_COLOR
  }

  getGeometryKinds(type: EnvironmentalEventType): EnvironmentalGeometryKind[] {
    return this.get(type).geometryKinds
  }

  getPresentation(type: EnvironmentalEventType): EnvironmentalEventPresentationAdapter {
    return this.get(type).presentation
  }

  getMapRenderer(type: EnvironmentalEventType): EnvironmentalEventMapRenderer {
    return this.get(type).mapRenderer
  }

  getPriorityProvider(type: EnvironmentalEventType): EventPriorityFactorProvider {
    return this.get(type).priorityProvider
  }

  getReportAdapter(type: EnvironmentalEventType): EventReportAdapter {
    return this.get(type).reportAdapter
  }

  getDetailSectionIds(type: EnvironmentalEventType): string[] {
    return this.get(type).detailSections.map((s) => s.id)
  }

  getSourceAdapters(type: EnvironmentalEventType): ObservationSourceDescriptor[] {
    return this.get(type).sources
  }

  /** Resolved finding rules: reusable (by id) + type-specific. */
  getFindingRules(type: EnvironmentalEventType): EnvironmentalFindingRule[] {
    const manifest = this.get(type)
    const reusable = manifest.findingRuleIds
      .map((id) => environmentalFindingRuleRegistry.get(id))
      .filter((r): r is EnvironmentalFindingRule => Boolean(r))
    return [...reusable, ...manifest.typeSpecificFindingRules]
  }

  /** Report adapter catalog (report builders never branch on type). */
  reportAdapterCatalog(): EventReportAdapter[] {
    return this.listEnabled().map((m) => m.reportAdapter)
  }

  /** Map renderer catalog. */
  mapRendererCatalog(): EnvironmentalEventMapRenderer[] {
    return this.listEnabled().map((m) => m.mapRenderer)
  }

  clear(): void {
    this.manifests.clear()
  }
}

/** Process-wide singleton registry. */
export const environmentalEventRegistry = new EnvironmentalEventRegistry()
