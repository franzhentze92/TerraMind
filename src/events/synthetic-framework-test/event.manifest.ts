/**
 * Synthetic framework test — single manifest.
 *
 * TEST-ONLY plugin. Disabled by default (feature flag off), so it is never
 * visible in normal runtime. It exists to prove that a brand-new plugin is
 * auto-detected end to end (registry, /types, national summary, report catalog,
 * map renderer catalog) with ZERO edits to central modules.
 */
import {
  defineEnvironmentalEvent,
  type EnvironmentalEventManifest,
} from '@/modules/environmental-events/manifest/event-manifest'
import { REUSABLE_RULE_IDS } from '@/modules/environmental-events/finding-rules/reusable-rules'
import { syntheticPresentationAdapter } from './event.presentation'
import { syntheticMapRenderer } from './event.map-renderer'
import {
  syntheticPriorityFactorProvider,
  SYNTHETIC_PRIORITY_PROVIDER_ID,
} from './event.priority-provider'
import { syntheticSpecificFindingRules } from './event.finding-rules'
import { syntheticSourceDescriptor } from './event.sources'
import { syntheticReportAdapter } from './event.report-adapter'
import { syntheticDetailSections } from './event.detail-sections'
import { syntheticMethodology } from './event.methodology'
import { syntheticLimitations } from './event.limitations'

export const syntheticFrameworkTestManifest: EnvironmentalEventManifest =
  defineEnvironmentalEvent({
    type: 'synthetic_framework_test',
    label: 'Evento sintético (prueba)',
    pluralLabel: 'Eventos sintéticos (prueba)',
    shortLabel: 'Sintético',
    description:
      'Tipo exclusivo para autopruebas del framework. Nunca habilitado en runtime.',
    icon: 'beaker',
    geometryKinds: ['polygon', 'multipolygon'],
    sources: [syntheticSourceDescriptor],
    presentation: syntheticPresentationAdapter,
    mapRenderer: syntheticMapRenderer,
    priorityProvider: syntheticPriorityFactorProvider,
    priorityProviderId: SYNTHETIC_PRIORITY_PROVIDER_ID,
    reportAdapter: syntheticReportAdapter,
    findingRuleIds: [
      REUSABLE_RULE_IDS.persistent,
      REUSABLE_RULE_IDS.multipleSources,
    ],
    typeSpecificFindingRules: syntheticSpecificFindingRules,
    detailSections: syntheticDetailSections,
    methodology: syntheticMethodology,
    limitations: syntheticLimitations,
    defaultFilters: {},
    supportedContextLayers: [],
    permissions: { view: 'incidents.view' },
    runtime: { featureFlag: 'synthetic_framework_test', enabledByDefault: false },
  })

export default syntheticFrameworkTestManifest
