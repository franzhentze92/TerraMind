import type { BiodiversityDashboardFilters } from './dto/biodiversity-dashboard.dto'
import { PERIOD_LABELS } from './api/biodiversity-page-filters'

export function buildVisualSummaryNarrative(input: {
  featuredCount: number
  recentCount: number
  zoneHighlights: Array<{ zoneName: string; recentCount: number; speciesCount: number }>
  periodLabel: string
}): string {
  if (input.featuredCount === 0) {
    return `No se encontraron imágenes con licencia utilizable en la muestra de ${input.periodLabel}. La ausencia visual no implica ausencia de biodiversidad.`
  }

  const parts = [
    `Se identificaron ${input.featuredCount} especies con evidencia fotográfica utilizable en territorios monitoreados durante ${input.periodLabel}.`,
  ]

  const top = [...input.zoneHighlights].sort((a, b) => b.recentCount - a.recentCount)[0]
  if (top && top.recentCount > 0) {
    parts.push(
      `${top.zoneName} concentra parte de la actividad visual reciente documentada en la muestra.`,
    )
  }

  const low = input.zoneHighlights.find((z) => z.speciesCount > 0 && z.recentCount === 0)
  if (low) {
    parts.push(
      `${low.zoneName} muestra baja cobertura visual reciente; no debe interpretarse como baja biodiversidad.`,
    )
  }

  parts.push(
    'Las imágenes son evidencia observacional con atribución y licencia por registro; no constituyen inventario ni abundancia real.',
  )

  return parts.join(' ')
}

export function buildVisualDetailNarrative(
  visual: { commonName?: string; taxonName: string; zoneName: string; isRecent: boolean },
): string {
  const name = visual.commonName ?? visual.taxonName
  const recency = visual.isRecent
    ? 'registrada recientemente'
    : 'documentada en el período consultado'
  return `${name} fue ${recency} en ${visual.zoneName}. La imagen proviene de una observación reportada en fuentes abiertas y no confirma presencia actual ni distribución exacta.`
}

export function periodLabelFromFilters(filters: BiodiversityDashboardFilters): string {
  return (
    {
      '30d': 'los últimos 30 días',
      '90d': 'los últimos 90 días',
      '1y': 'el último año',
      '5y': 'los últimos 5 años',
    }[filters.period] ?? PERIOD_LABELS[filters.period]
  )
}
