import {
  PROTECTED_AREAS_SOURCE_NAME,
  PROTECTED_AREAS_SOURCE_VERSION,
} from '@/modules/fires/config/fire.constants'
import type {
  ProtectedAreaContextDto,
  ProtectedAreaIntersectDto,
  ProtectedAreaNearestDto,
} from '@/modules/fires/types/fire.dto'
import { computeProximityLabel } from '@/modules/fires/utils/proximity-label'
import { buildTerritorialDisplayName } from '@/modules/fires/utils/territorial-display'
import type { FireEventContextRow } from '@/pipeline/stores/territorial.store'
import { getFeaturesByIds } from '@/pipeline/stores/territorial.store'

function namesFromProperties(
  properties: Record<string, unknown> | null | undefined,
  fallbackName: string | null,
): {
  display_name: string
  general_name: string | null
  specific_name: string | null
  feature_type: string | null
} {
  const general_name = (properties?.general_name as string | undefined)?.trim() || null
  const specific_name = (properties?.specific_name as string | undefined)?.trim() || null
  const feature_type =
    (properties?.specific_category as string | undefined)?.trim() ||
    (properties?.general_category as string | undefined)?.trim() ||
    null

  const display_name =
    buildTerritorialDisplayName({
      general_name,
      specific_name,
      general_category: properties?.general_category as string | undefined,
      specific_category: properties?.specific_category as string | undefined,
    }) ||
    (properties?.display_name as string | undefined)?.trim() ||
    fallbackName ||
    'Área protegida'

  return { display_name, general_name, specific_name, feature_type }
}

export async function buildProtectedAreaContextDto(
  context: FireEventContextRow | null,
): Promise<ProtectedAreaContextDto | null> {
  if (!context) return null

  const featureIds = [
    ...(context.protected_area_ids ?? []),
    ...(context.nearest_protected_area_id ? [context.nearest_protected_area_id] : []),
  ]
  const uniqueIds = [...new Set(featureIds)]
  const features = await getFeaturesByIds(uniqueIds)
  const featureMap = new Map(features.map((f) => [f.id, f]))

  const intersecting_areas: ProtectedAreaIntersectDto[] = (context.protected_area_ids ?? [])
    .map((id, index) => {
      const feature = featureMap.get(id)
      const fallbackName = context.protected_area_names?.[index] ?? null
      const names = namesFromProperties(feature?.properties ?? null, fallbackName)
      return names
    })
    .filter((area) => area.display_name)

  const nearestDistance =
    context.nearest_protected_area_distance_m != null
      ? Number(context.nearest_protected_area_distance_m)
      : null

  let nearest_area: ProtectedAreaNearestDto | null = null
  if (context.nearest_protected_area_id) {
    const feature = featureMap.get(context.nearest_protected_area_id)
    const names = namesFromProperties(
      feature?.properties ?? null,
      context.nearest_protected_area_name,
    )
    nearest_area = {
      ...names,
      distance_m: nearestDistance,
      proximity_label: computeProximityLabel(
        nearestDistance,
        context.inside_protected_area,
      ),
    }
  }

  const sourceVersion =
    (context.source_versions?.gt_protected_areas as { version?: string } | undefined)?.version ??
    PROTECTED_AREAS_SOURCE_VERSION

  return {
    status: context.protected_area_context_status as ProtectedAreaContextDto['status'],
    inside_protected_area: context.inside_protected_area,
    detections_inside_count: context.detections_inside_protected_area_count,
    intersecting_areas,
    nearest_area,
    diagnostic_geometry_intersects_protected_area:
      context.diagnostic_geometry_intersects_protected_area,
    source_name: PROTECTED_AREAS_SOURCE_NAME,
    source_version: sourceVersion,
    generated_at: context.generated_at,
  }
}
