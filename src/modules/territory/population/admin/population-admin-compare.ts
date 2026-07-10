import { populationDiffPct } from '@/modules/territory/population/processing/population-conservation'
import type { AdminRasterComparison } from '@/modules/territory/population/admin/population-admin.types'
import { WORLDPOP_REFERENCE_YEAR } from '@/modules/territory/population/providers/worldpop/worldpop.manifest'

export function interpretAdminRasterDifference(percentageDifference: number): string {
  const abs = Math.abs(percentageDifference)
  if (abs < 5) return 'Estimaciones con concordancia cercana.'
  if (abs <= 15) {
    return 'Diferencia moderada entre la fuente oficial y el modelo espacial.'
  }
  return 'Diferencia significativa; revisar distribución espacial, límites y año.'
}

export function buildAdminRasterComparison(input: {
  adminLevel: 'national' | 'department' | 'municipality'
  adminCode: string
  adminName: string
  officialPopulation: number
  officialReferenceYear: number
  statisticType: 'census' | 'projection'
  temporalAlignment: AdminRasterComparison['temporalAlignment']
  rasterConstrainedSum?: number
  rasterUnconstrainedSum?: number
  coveragePct?: number
}): AdminRasterComparison {
  const constrainedDiff =
    input.rasterConstrainedSum != null
      ? populationDiffPct(input.officialPopulation, input.rasterConstrainedSum)
      : undefined
  const unconstrainedDiff =
    input.rasterUnconstrainedSum != null
      ? populationDiffPct(input.officialPopulation, input.rasterUnconstrainedSum)
      : undefined

  const primaryDiff = constrainedDiff ?? unconstrainedDiff ?? 0

  return {
    adminLevel: input.adminLevel,
    adminCode: input.adminCode,
    adminName: input.adminName,
    officialPopulation: input.officialPopulation,
    officialReferenceYear: input.officialReferenceYear,
    statisticType: input.statisticType,
    rasterConstrainedSum: input.rasterConstrainedSum,
    rasterUnconstrainedSum: input.rasterUnconstrainedSum,
    absoluteDifferenceConstrained:
      input.rasterConstrainedSum != null
        ? Math.round(input.rasterConstrainedSum - input.officialPopulation)
        : undefined,
    percentageDifferenceConstrained: constrainedDiff,
    absoluteDifferenceUnconstrained:
      input.rasterUnconstrainedSum != null
        ? Math.round(input.rasterUnconstrainedSum - input.officialPopulation)
        : undefined,
    percentageDifferenceUnconstrained: unconstrainedDiff,
    temporalAlignment:
      input.officialReferenceYear === WORLDPOP_REFERENCE_YEAR
        ? input.temporalAlignment
        : 'mismatch',
    coveragePct: input.coveragePct,
    interpretation: interpretAdminRasterDifference(primaryDiff),
  }
}
