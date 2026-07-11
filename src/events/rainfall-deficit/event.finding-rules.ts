/** Déficit de precipitación — type-specific finding rules. */
import type { EnvironmentalFindingRule } from '@/modules/environmental-events/contracts/finding-rule'
import {
  CANDIDATE_THRESHOLD,
  MINIMUM_EXPECTED_RAINFALL_MM,
  SEVERE_THRESHOLD,
} from '@/modules/precipitation/rainfall-deficit/rainfall-deficit.config'
import type { RainfallDeficitEnvironmentalEvent } from './event.types'

export const RAINFALL_DEFICIT_RULE_IDS = {
  lowPercentile: 'RAINFALL_DEFICIT_LOW_PERCENTILE',
  severe: 'RAINFALL_DEFICIT_SEVERE',
  agriculturalArea: 'RAINFALL_DEFICIT_AGRICULTURAL_AREA',
  recovering: 'RAINFALL_DEFICIT_RECOVERING',
} as const

export const rainfallDeficitSpecificFindingRules: EnvironmentalFindingRule<RainfallDeficitEnvironmentalEvent>[] =
  [
    {
      id: RAINFALL_DEFICIT_RULE_IDS.lowPercentile,
      category: 'type_specific',
      supportedEventTypes: ['rainfall_deficit'],
      async evaluate(event) {
        const w = event.attributes.windows.days30
        const matched =
          w.historicalPercentile !== undefined &&
          w.historicalPercentile <= CANDIDATE_THRESHOLD.historicalPercentileMax
        return {
          ruleId: RAINFALL_DEFICIT_RULE_IDS.lowPercentile,
          matched,
          title: 'Percentil histórico bajo',
          rationale: matched
            ? `Percentil histórico P${w.historicalPercentile}, por debajo del umbral configurado.`
            : 'El percentil histórico no cruza el umbral configurado.',
        }
      },
    },
    {
      id: RAINFALL_DEFICIT_RULE_IDS.severe,
      category: 'type_specific',
      supportedEventTypes: ['rainfall_deficit'],
      async evaluate(event) {
        const w = event.attributes.windows.days30
        const matched =
          event.attributes.intensityClass === 'severe' &&
          (w.relativeDeficitPercent ?? 0) >= SEVERE_THRESHOLD.relativeDeficitPercent &&
          (w.historicalPercentile ?? 100) <= SEVERE_THRESHOLD.historicalPercentileMax &&
          (w.expectedRainfallMm ?? 0) >= MINIMUM_EXPECTED_RAINFALL_MM &&
          event.attributes.consecutiveDeficitPentads >= SEVERE_THRESHOLD.minConsecutivePentads
        return {
          ruleId: RAINFALL_DEFICIT_RULE_IDS.severe,
          matched,
          title: 'Déficit severo',
          rationale: matched
            ? 'Déficit relativo, percentil, persistencia y piso estacional cumplen el umbral severo.'
            : 'No se cumplen simultáneamente los criterios de déficit severo.',
        }
      },
    },
    {
      id: RAINFALL_DEFICIT_RULE_IDS.agriculturalArea,
      category: 'type_specific',
      supportedEventTypes: ['rainfall_deficit'],
      async evaluate(event) {
        const overlap = event.attributes.croplandOverlapKm2
        const matched = overlap !== undefined && overlap > 0
        return {
          ruleId: RAINFALL_DEFICIT_RULE_IDS.agriculturalArea,
          matched,
          title: 'Superposición con área agrícola',
          rationale: matched
            ? 'El déficit de precipitación se superpone con áreas clasificadas como agrícolas.'
            : 'Sin intersección verificada con capa agrícola confiable.',
        }
      },
    },
    {
      id: RAINFALL_DEFICIT_RULE_IDS.recovering,
      category: 'type_specific',
      supportedEventTypes: ['rainfall_deficit'],
      async evaluate(event) {
        const matched =
          event.attributes.intensityClass === 'recovering' || event.lifecycleState === 'declining'
        return {
          ruleId: RAINFALL_DEFICIT_RULE_IDS.recovering,
          matched,
          title: 'Recuperación de precipitación',
          rationale: matched
            ? 'La intensidad o extensión disminuye de forma sostenida.'
            : 'Sin señal sostenida de recuperación.',
        }
      },
    },
  ]
