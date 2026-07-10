import { populationDiffPct } from '@/modules/territory/population/processing/population-conservation'
import type { PopulationComparison } from '@/modules/territory/population/population.types'

export function interpretVariantDifference(percentageDifference: number): string {
  const abs = Math.abs(percentageDifference)
  if (abs < 5) {
    return 'Ambos modelos presentan estimaciones similares.'
  }
  if (abs <= 20) {
    return 'Los modelos difieren moderadamente, posiblemente por la distribución espacial de asentamientos.'
  }
  return 'Existe una diferencia significativa entre los modelos constrained y unconstrained; interpretar con cautela.'
}

export function buildPopulationComparison(
  constrainedPopulation: number,
  unconstrainedPopulation: number,
): PopulationComparison {
  const absoluteDifference = Math.round(unconstrainedPopulation - constrainedPopulation)
  const percentageDifference = populationDiffPct(
    constrainedPopulation,
    unconstrainedPopulation,
  )
  return {
    constrained: constrainedPopulation,
    unconstrained: unconstrainedPopulation,
    absoluteDifference,
    percentageDifference,
    interpretation: interpretVariantDifference(percentageDifference),
  }
}
