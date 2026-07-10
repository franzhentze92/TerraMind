export interface LandCoverDistributionSegment {
  class: string
  label: string
  percentage: number
  area_ha?: number | null
  count?: number
}

const OTHERS_CLASS = 'others'
const OTHERS_LABEL = 'Otros'

/**
 * Agrupa clases menores en «Otros» (máx. maxClasses principales).
 * Los porcentajes se redondean a una decimal; el remanente se ajusta al segmento mayor.
 */
export function groupLandCoverDistribution(
  entries: LandCoverDistributionSegment[],
  maxClasses = 5,
): LandCoverDistributionSegment[] {
  if (entries.length === 0) return []

  const sorted = [...entries].sort((a, b) => b.percentage - a.percentage)
  const primary = sorted.slice(0, maxClasses)
  const rest = sorted.slice(maxClasses)

  if (rest.length === 0) {
    return roundSegments(primary)
  }

  const othersPct = rest.reduce((sum, row) => sum + row.percentage, 0)
  const othersArea = rest.reduce((sum, row) => sum + (row.area_ha ?? 0), 0)
  const othersCount = rest.reduce((sum, row) => sum + (row.count ?? 0), 0)

  const grouped: LandCoverDistributionSegment[] = [
    ...primary,
    {
      class: OTHERS_CLASS,
      label: OTHERS_LABEL,
      percentage: Math.round(othersPct * 10) / 10,
      area_ha: othersArea > 0 ? Math.round(othersArea * 10) / 10 : null,
      count: othersCount > 0 ? othersCount : undefined,
    },
  ]

  return roundSegments(grouped)
}

function roundSegments(
  segments: LandCoverDistributionSegment[],
): LandCoverDistributionSegment[] {
  const rounded = segments.map((row) => ({
    ...row,
    percentage: Math.round(row.percentage * 10) / 10,
    area_ha:
      row.area_ha != null ? Math.round(row.area_ha * 10) / 10 : row.area_ha,
  }))

  const total = rounded.reduce((sum, row) => sum + row.percentage, 0)
  const drift = Math.round((100 - total) * 10) / 10
  if (drift !== 0 && rounded.length > 0) {
    const idx = rounded.reduce(
      (best, row, i, arr) => (row.percentage > arr[best].percentage ? i : best),
      0,
    )
    rounded[idx] = {
      ...rounded[idx],
      percentage: Math.round((rounded[idx].percentage + drift) * 10) / 10,
    }
  }

  return rounded
}

export function formatLandCoverPercentage(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1)
}
