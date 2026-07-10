import type { PopulationZoneDto } from '@/modules/fires/types/fire.dto'
import {
  CONFIDENCE_LEVEL_LABELS,
  formatModelledRangeLabel,
  RANGE_TOOLTIP,
} from '@/modules/territory/population/population-estimate-confidence'
import { formatPopulationCompact } from '@/modules/fires/utils/population-context.dto'

export interface PopulationZoneDisplay {
  primaryText: string
  confidenceLabel: string
  tooltip?: string
  isRange: boolean
  usePointEstimate: boolean
}

export function formatPopulationZoneDisplay(zone: PopulationZoneDto): PopulationZoneDisplay {
  const confidence = zone.confidence
  const mode = confidence?.recommended_display_mode ?? 'single_estimate'
  const level = confidence?.level ?? 'high'

  if (mode === 'modelled_range' && zone.modelled_range) {
    const range = formatModelledRangeLabel(zone.modelled_range.lower, zone.modelled_range.upper)
    return {
      primaryText: `Rango: ${range}`,
      confidenceLabel: CONFIDENCE_LEVEL_LABELS[level],
      tooltip: RANGE_TOOLTIP,
      isRange: true,
      usePointEstimate: false,
    }
  }

  if (mode === 'estimate_with_uncertainty') {
    return {
      primaryText: `≈ ${formatPopulationCompact(zone.estimated_population)}`,
      confidenceLabel: CONFIDENCE_LEVEL_LABELS[level],
      isRange: false,
      usePointEstimate: true,
    }
  }

  return {
    primaryText: `≈ ${formatPopulationCompact(zone.estimated_population)}`,
    confidenceLabel: CONFIDENCE_LEVEL_LABELS[level],
    isRange: false,
    usePointEstimate: true,
  }
}
