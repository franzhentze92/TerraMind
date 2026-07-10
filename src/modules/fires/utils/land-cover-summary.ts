import type {
  LandCoverContextDto,
  LandCoverPointEvidenceDto,
  LandCoverZoneDto,
} from '@/modules/fires/types/fire.dto'
import { landCoverDisplayLabel } from '@/modules/territory/land-cover/land-cover-taxonomy'
import { formatLandCoverPercentage } from '@/modules/fires/utils/land-cover-distribution'

function dominantLabel(point: LandCoverPointEvidenceDto): string | null {
  if (point.mixed) return null
  if (point.dominant_class) return landCoverDisplayLabel(point.dominant_class)
  const top = point.class_distribution[0]
  return top ? top.label : null
}

function zoneDominantLabel(zone: LandCoverZoneDto | null): string | null {
  if (!zone) return null
  return zone.dominant_label ?? landCoverDisplayLabel(zone.dominant_class)
}

function zoneDominantPct(zone: LandCoverZoneDto | null): number | null {
  if (!zone) return null
  const top = zone.class_distribution[0]
  return top?.percentage ?? null
}

function pointClassList(point: LandCoverPointEvidenceDto): string {
  return point.class_distribution
    .map((row) => `${row.label}: ${row.count} detección${row.count === 1 ? '' : 'es'}`)
    .join('; ')
}

function mixedClassNames(point: LandCoverPointEvidenceDto): string {
  return point.class_distribution.map((row) => row.label).join(' y ')
}

/** Narrativa corta por reglas — cobertura clasificada, sin afirmar tipo de incendio. */
export function buildLandCoverNarrative(
  point: LandCoverPointEvidenceDto,
  zone1km: LandCoverZoneDto | null,
): string {
  const pointLabel = dominantLabel(point)
  const envLabel = zoneDominantLabel(zone1km)
  const envPct = zoneDominantPct(zone1km)

  if (point.mixed) {
    const mix = mixedClassNames(point)
    if (envLabel) {
      const pctText = envPct != null ? ` (${formatLandCoverPercentage(envPct)}%)` : ''
      return `Las detecciones presentan una combinación de ${mix}. El entorno de 1 km está dominado por ${envLabel.toLowerCase()}${pctText}.`
    }
    return `Las detecciones presentan una combinación de ${mix}.`
  }

  if (pointLabel && envLabel) {
    const sameClass =
      point.dominant_class != null &&
      zone1km?.dominant_class != null &&
      point.dominant_class === zone1km.dominant_class

    if (sameClass) {
      const pctText = envPct != null ? ` (${formatLandCoverPercentage(envPct)}%)` : ''
      return `Las detecciones se ubican sobre cobertura clasificada como ${pointLabel.toLowerCase()}. El entorno de 1 km también está dominado por ${envLabel.toLowerCase()}${pctText}.`
    }

    const pctText = envPct != null ? ` (${formatLandCoverPercentage(envPct)}%)` : ''
    return `Las detecciones se ubican sobre cobertura clasificada como ${pointLabel.toLowerCase()}, mientras que el entorno de 1 km está dominado por ${envLabel.toLowerCase()}${pctText}.`
  }

  if (pointLabel) {
    return `Las detecciones se ubican sobre cobertura clasificada como ${pointLabel.toLowerCase()}.`
  }

  return 'Cobertura del suelo clasificada disponible para revisión.'
}

export function buildLandCoverPointHeading(point: LandCoverPointEvidenceDto): string {
  if (point.mixed) return 'Cobertura mixta en las detecciones'
  const label = dominantLabel(point)
  return label ?? 'Cobertura en las detecciones'
}

export function buildLandCoverPointSubtext(point: LandCoverPointEvidenceDto): string {
  if (point.mixed) return pointClassList(point)
  const sampled = point.detections_sampled
  const top = point.class_distribution[0]
  const count = top?.count ?? sampled
  return `${count} de ${sampled} detección${sampled === 1 ? '' : 'es'} sobre esta clase`
}

export type LandCoverUiState =
  | 'loading'
  | 'complete'
  | 'partial'
  | 'unavailable'
  | 'error'
  | 'outdated_source'
  | 'missing_zone'
  | 'stale_context'

export function resolveLandCoverUiState(input: {
  isLoading?: boolean
  context: LandCoverContextDto | null | undefined
  expectedRadii?: readonly number[]
}): LandCoverUiState {
  if (input.isLoading) return 'loading'
  if (!input.context) return 'unavailable'

  const { context } = input
  const expected = input.expectedRadii ?? [500, 1000]
  const presentRadii = new Set(context.zones.map((z) => z.radius_m))
  const missingZone = expected.some((r) => !presentRadii.has(r))

  if (context.warnings.some((w) => w.includes('2021') || w.includes('año de referencia'))) {
    if (missingZone || context.status === 'partial') return 'partial'
    return 'outdated_source'
  }

  if (missingZone) return 'missing_zone'
  if (context.status === 'error') return 'error'
  if (context.status === 'unavailable') return 'unavailable'
  if (context.status === 'partial') return 'partial'
  return 'complete'
}

export function landCoverUiStateMessage(state: LandCoverUiState): string | null {
  switch (state) {
    case 'loading':
      return null
    case 'unavailable':
      return 'Contexto de cobertura del suelo aún no calculado.'
    case 'error':
      return 'No se pudo cargar el contexto de cobertura del suelo.'
    case 'partial':
      return 'Contexto de cobertura parcial — revise advertencias y zonas disponibles.'
    case 'missing_zone':
      return 'Falta al menos una zona de entorno analizada (500 m o 1 km).'
    case 'outdated_source':
      return 'Producto de cobertura de referencia 2021; no representa la condición actual del territorio.'
    case 'stale_context':
      return 'Versión de contexto desactualizada respecto al producto vigente.'
    default:
      return null
  }
}

/** Fragmento breve para popup del mapa. */
export function buildLandCoverMapSnippet(context: LandCoverContextDto): string {
  const point = dominantLabel(context.point_evidence)
  const zone1km = context.zones.find((z) => z.radius_m === 1000) ?? context.zones.at(-1) ?? null
  const envLabel = zoneDominantLabel(zone1km)
  const envPct = zoneDominantPct(zone1km)

  const lines: string[] = []
  if (point) {
    lines.push(`Cobertura en detecciones: ${point}`)
  } else if (context.point_evidence.mixed) {
    lines.push('Cobertura en detecciones: mixta')
  }
  if (envLabel && envPct != null) {
    lines.push(`Entorno 1 km: ${envLabel} ${formatLandCoverPercentage(envPct)}%`)
  }
  return lines.join('\n')
}
