/**
 * Environmental Event Framework — single event manifest.
 *
 * ONE declaration per event type is the sole integration point. The registry,
 * generic API, Situación Nacional summary, reports, map and UI all read from the
 * manifest. Adding an event means shipping a manifest inside a self-contained
 * plugin (src/events/<type>/), never editing multiple registries by hand.
 */
import type { TerramindPermission } from '@/core/auth/permissions'
import type {
  EnvironmentalEventType,
  EnvironmentalGeometryKind,
} from '@/modules/environmental-events/types/taxonomy'
import type { EnvironmentalEventQuery } from '@/modules/environmental-events/types/environmental-event.types'
import type { ObservationSourceDescriptor } from '@/modules/environmental-events/types/observation.types'
import type { EnvironmentalEventPresentationAdapter } from '@/modules/environmental-events/contracts/presentation'
import type { EnvironmentalEventMapRenderer } from '@/modules/environmental-events/contracts/map-renderer'
import type { EventPriorityFactorProvider } from '@/modules/environmental-events/contracts/priority-provider'
import type { EnvironmentalFindingRule } from '@/modules/environmental-events/contracts/finding-rule'
import type { EventReportAdapter } from '@/modules/environmental-events/contracts/report-adapter'

export interface EventDetailSection {
  id: string
  title: string
}

export interface EventRuntimeConfig {
  /** Flag that gates runtime visibility. */
  featureFlag: string
  /** Whether the type is enabled without any flag (production events). */
  enabledByDefault: boolean
}

/**
 * Neutral fallback accent color for event types that do not declare one.
 * The canonical per-type color lives in `EnvironmentalEventManifest.accentColor`.
 */
export const NEUTRAL_ACCENT_COLOR = '#94a3b8'

/**
 * The single source of truth for an event type. Only bundle-safe (pure /
 * API-backed) pieces live here; server-only runtime (repository / detector /
 * source fetch) is wired by the plugin's `event.server.ts` via the server
 * registry, keyed by the same `type`.
 */
export interface EnvironmentalEventManifest {
  schemaVersion: number
  type: EnvironmentalEventType
  label: string
  pluralLabel: string
  shortLabel?: string
  description: string
  icon: string
  /**
   * Canonical accent color (hex) for this event type's global visual identity:
   * KPI chips, donut/legend, badges, selected-event panel, timeline markers,
   * dynamic navigation, and type-related hover/selected states. This is the SINGLE
   * source of visual color for the type. Map renderers may keep internal severity
   * scales, but their base color should originate from this value. Optional; when
   * absent, consumers use `NEUTRAL_ACCENT_COLOR`.
   */
  accentColor?: string
  geometryKinds: EnvironmentalGeometryKind[]

  sources: ObservationSourceDescriptor[]
  presentation: EnvironmentalEventPresentationAdapter
  mapRenderer: EnvironmentalEventMapRenderer
  priorityProvider: EventPriorityFactorProvider
  priorityProviderId: string
  reportAdapter: EventReportAdapter

  /** Reusable rules activated by id (see finding-rules/reusable-rules.ts). */
  findingRuleIds: string[]
  /** Rules unique to this event type. */
  typeSpecificFindingRules: EnvironmentalFindingRule[]

  detailSections: EventDetailSection[]
  methodology: string
  limitations: string[]
  defaultFilters: Partial<EnvironmentalEventQuery>
  supportedContextLayers: string[]
  permissions: { view: TerramindPermission }
  runtime: EventRuntimeConfig
}

export type EnvironmentalEventManifestInput = Omit<
  EnvironmentalEventManifest,
  'schemaVersion' | 'runtime'
> & {
  schemaVersion?: number
  runtime?: Partial<EventRuntimeConfig> & { featureFlag: string }
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ManifestError'
  }
}

/**
 * Validates and normalizes a manifest. This is the ONE function every plugin
 * calls; it fills defaults and fails loudly on structural gaps.
 */
export function defineEnvironmentalEvent(
  input: EnvironmentalEventManifestInput,
): EnvironmentalEventManifest {
  const missing: string[] = []
  if (!input.type) missing.push('type')
  if (!input.label) missing.push('label')
  if (!input.pluralLabel) missing.push('pluralLabel')
  if (!input.icon) missing.push('icon')
  if (!input.geometryKinds?.length) missing.push('geometryKinds')
  if (!input.sources?.length) missing.push('sources')
  if (!input.presentation) missing.push('presentation')
  if (!input.mapRenderer) missing.push('mapRenderer')
  if (!input.priorityProvider) missing.push('priorityProvider')
  if (!input.priorityProviderId) missing.push('priorityProviderId')
  if (!input.reportAdapter) missing.push('reportAdapter')
  if (!input.detailSections?.length) missing.push('detailSections')
  if (!input.methodology) missing.push('methodology')
  if (!input.limitations?.length) missing.push('limitations')
  if (!input.permissions?.view) missing.push('permissions.view')
  if (!input.runtime?.featureFlag) missing.push('runtime.featureFlag')

  if (input.presentation && input.presentation.eventType !== input.type) {
    missing.push('presentation.eventType-mismatch')
  }
  if (input.mapRenderer && input.mapRenderer.eventType !== input.type) {
    missing.push('mapRenderer.eventType-mismatch')
  }
  if (input.priorityProvider && input.priorityProvider.eventType !== input.type) {
    missing.push('priorityProvider.eventType-mismatch')
  }
  if (input.reportAdapter && input.reportAdapter.eventType !== input.type) {
    missing.push('reportAdapter.eventType-mismatch')
  }

  if (input.accentColor !== undefined && !/^#[0-9a-fA-F]{6}$/.test(input.accentColor)) {
    missing.push('accentColor-invalid-hex')
  }

  if (missing.length > 0) {
    throw new ManifestError(
      `Manifest incompleto para "${input.type}": faltan ${missing.join(', ')}`,
    )
  }

  return {
    ...input,
    schemaVersion: input.schemaVersion ?? 1,
    findingRuleIds: input.findingRuleIds ?? [],
    typeSpecificFindingRules: input.typeSpecificFindingRules ?? [],
    runtime: {
      featureFlag: input.runtime!.featureFlag,
      enabledByDefault: input.runtime!.enabledByDefault ?? false,
    },
  }
}
