import type { BiodiversityVisualSummaryDto } from './biodiversity-visual.types'

export function biodiversityVisualStatusMessage(
  data: BiodiversityVisualSummaryDto | undefined,
  options: { isLoading?: boolean; isError?: boolean },
): string {
  if (options.isLoading) return 'Recuperando evidencia fotográfica de las fuentes…'
  if (options.isError) return 'No se pudo cargar la capa visual. Intente actualizar.'
  if (!data) return ''

  switch (data.status) {
    case 'success':
      return data.narrative
    case 'partial':
      return `${data.narrative} Algunas fuentes no respondieron; la muestra visual puede estar incompleta.`
    case 'provider_unavailable':
      return 'Las fuentes de imágenes no están disponibles temporalmente.'
    case 'all_media_rejected':
      return 'Hay registros en la muestra, pero ninguna imagen cumple licencia utilizable para mostrarse.'
    case 'empty':
      return 'No se encontró evidencia fotográfica con licencia utilizable para los filtros actuales.'
    case 'error':
      return 'Error al recuperar evidencia visual.'
    default:
      return data.narrative
  }
}

export function formatResearchGradeLabel(
  researchGradePct: number | null,
  inaturalistCount: number,
): string {
  if (inaturalistCount === 0) return 'Grado de investigación: N/D'
  if (researchGradePct === null) return 'Grado de investigación: N/D'
  return `Grado de investigación: ${researchGradePct}%`
}
