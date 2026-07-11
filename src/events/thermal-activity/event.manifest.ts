/**
 * Thermal activity — single event manifest (facade over existing thermal impl).
 *
 * This ONE declaration is the sole integration point for actividad térmica.
 */
import {
  defineEnvironmentalEvent,
  type EnvironmentalEventManifest,
} from '@/modules/environmental-events/manifest/event-manifest'
import { REUSABLE_RULE_IDS } from '@/modules/environmental-events/finding-rules/reusable-rules'
import { thermalPresentationAdapter } from './event.presentation'
import { thermalMapRenderer } from './event.map-renderer'
import {
  thermalPriorityFactorProvider,
  THERMAL_PRIORITY_PROVIDER_ID,
} from './event.priority-provider'
import { thermalSpecificFindingRules } from './event.finding-rules'
import { firmsSourceDescriptor } from './event.sources'
import { thermalReportAdapter } from './event.report-adapter'
import { thermalDetailSections } from './event.detail-sections'
import { thermalMethodology } from './event.methodology'
import { thermalLimitations } from './event.limitations'

export const thermalActivityManifest: EnvironmentalEventManifest = defineEnvironmentalEvent({
  type: 'thermal_activity',
  label: 'Actividad térmica',
  pluralLabel: 'Eventos térmicos',
  shortLabel: 'Térmica',
  description:
    'Eventos térmicos agrupados a partir de detecciones satelitales FIRMS en Guatemala.',
  icon: 'flame',
  geometryKinds: ['point', 'multipoint'],
  sources: [firmsSourceDescriptor],
  presentation: thermalPresentationAdapter,
  mapRenderer: thermalMapRenderer,
  priorityProvider: thermalPriorityFactorProvider,
  priorityProviderId: THERMAL_PRIORITY_PROVIDER_ID,
  reportAdapter: thermalReportAdapter,
  findingRuleIds: [
    REUSABLE_RULE_IDS.nearPopulation,
    REUSABLE_RULE_IDS.nearProtectedArea,
    REUSABLE_RULE_IDS.nearRoad,
    REUSABLE_RULE_IDS.insideCropland,
    REUSABLE_RULE_IDS.withBiodiversity,
    REUSABLE_RULE_IDS.expanding,
    REUSABLE_RULE_IDS.persistent,
    REUSABLE_RULE_IDS.multipleSources,
  ],
  typeSpecificFindingRules: thermalSpecificFindingRules,
  detailSections: thermalDetailSections,
  methodology: thermalMethodology,
  limitations: thermalLimitations,
  defaultFilters: {},
  supportedContextLayers: [
    'protected_areas',
    'land_cover',
    'population',
    'climate',
    'biodiversity',
  ],
  permissions: { view: 'incidents.view' },
  runtime: { featureFlag: 'thermal_activity', enabledByDefault: true },
})

export default thermalActivityManifest
