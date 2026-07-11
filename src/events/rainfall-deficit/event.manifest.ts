/**
 * Déficit de precipitación — single manifest (SCAFFOLD, disabled).
 * Sole integration point. Enable only after the science is implemented.
 */
import {
  defineEnvironmentalEvent,
  type EnvironmentalEventManifest,
} from '@/modules/environmental-events/manifest/event-manifest'
import { REUSABLE_RULE_IDS } from '@/modules/environmental-events/finding-rules/reusable-rules'
import { rainfallDeficitPresentationAdapter } from './event.presentation'
import { rainfallDeficitMapRenderer } from './event.map-renderer'
import {
  rainfallDeficitPriorityFactorProvider,
  RAINFALL_DEFICIT_PRIORITY_PROVIDER_ID,
} from './event.priority-provider'
import { rainfallDeficitSpecificFindingRules } from './event.finding-rules'
import { rainfallDeficitSourceDescriptors } from './event.sources'
import { rainfallDeficitReportAdapter } from './event.report-adapter'
import { rainfallDeficitDetailSections } from './event.detail-sections'
import { rainfallDeficitMethodology } from './event.methodology'
import { rainfallDeficitLimitations } from './event.limitations'

export const rainfallDeficitManifest: EnvironmentalEventManifest = defineEnvironmentalEvent({
  type: 'rainfall_deficit',
  label: 'Déficit de precipitación',
  pluralLabel: 'Déficits de precipitación',
  description:
    'Territorios donde la precipitación acumulada reciente está significativamente por debajo de lo históricamente esperado para la misma zona y época del año (CHIRPS v3 pentadal).',
  icon: 'cloud-rain',
  geometryKinds: ['polygon', 'multipolygon', 'administrative_area'],
  sources: rainfallDeficitSourceDescriptors,
  presentation: rainfallDeficitPresentationAdapter,
  mapRenderer: rainfallDeficitMapRenderer,
  priorityProvider: rainfallDeficitPriorityFactorProvider,
  priorityProviderId: RAINFALL_DEFICIT_PRIORITY_PROVIDER_ID,
  reportAdapter: rainfallDeficitReportAdapter,
  findingRuleIds: [
    REUSABLE_RULE_IDS.persistent,
    REUSABLE_RULE_IDS.expanding,
  ],
  typeSpecificFindingRules: rainfallDeficitSpecificFindingRules,
  detailSections: rainfallDeficitDetailSections,
  methodology: rainfallDeficitMethodology,
  limitations: rainfallDeficitLimitations,
  defaultFilters: {},
  supportedContextLayers: ['municipalities', 'departments', 'watersheds', 'cropland', 'rural_population', 'protected_areas', 'dry_corridor'],
  permissions: { view: 'incidents.view' },
  runtime: { featureFlag: 'rainfall_deficit', enabledByDefault: false },
})

export default rainfallDeficitManifest
