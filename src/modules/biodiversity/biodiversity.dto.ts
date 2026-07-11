import { z } from 'zod'
import { BIODIVERSITY_CONFIG } from './config/biodiversity.config'
import type { BiodiversityOccurrence, BiodiversityProviderId } from './biodiversity.types'
import { canExposeExactLocation } from './biodiversity-privacy'

const providerSchema = z.enum(['gbif', 'inaturalist', 'all'])

export const biodiversitySearchQuerySchema = z
  .object({
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius_m: z.coerce.number().min(1).max(BIODIVERSITY_CONFIG.maxRadiusM).optional(),
    from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    taxon: z.string().min(1).max(200).optional(),
    provider: providerSchema.optional(),
    mode: z.enum(['summary', 'detail']).optional(),
    quality: z.enum(['research', 'all']).optional(),
    limit: z.coerce.number().int().min(1).max(BIODIVERSITY_CONFIG.maxLimit).optional(),
    cursor: z.string().max(500).optional(),
    geometry: z.string().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    const hasPoint = data.lat !== undefined && data.lng !== undefined
    const hasGeometry = Boolean(data.geometry)
    if (!hasPoint && !hasGeometry) {
      ctx.addIssue({
        code: 'custom',
        message: 'Se requiere lat/lng o geometry',
        path: ['lat'],
      })
    }
    if ((data.lat !== undefined) !== (data.lng !== undefined)) {
      ctx.addIssue({ code: 'custom', message: 'lat y lng deben ir juntos', path: ['lng'] })
    }
    if (data.geometry) {
      const upper = data.geometry.toUpperCase()
      if (!upper.startsWith('POINT(') && !upper.startsWith('POLYGON((')) {
        ctx.addIssue({
          code: 'custom',
          message: 'Solo se permiten geometrías POINT o POLYGON simples',
          path: ['geometry'],
        })
      }
      const vertexCount = (data.geometry.match(/,/g) ?? []).length
      if (vertexCount > BIODIVERSITY_CONFIG.maxGeometryVertices) {
        ctx.addIssue({
          code: 'custom',
          message: 'Geometría demasiado compleja',
          path: ['geometry'],
        })
      }
    }
  })

export const biodiversityTaxonResolveSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  taxon_id: z.string().min(1).max(50).optional(),
  provider: providerSchema.optional(),
})

export type BiodiversitySearchQueryDto = z.infer<typeof biodiversitySearchQuerySchema>
export type BiodiversityTaxonResolveDto = z.infer<typeof biodiversityTaxonResolveSchema>

export function toInternalSearchQuery(dto: BiodiversitySearchQueryDto) {
  const providers: BiodiversityProviderId[] | undefined =
    !dto.provider || dto.provider === 'all' ? undefined : [dto.provider]
  return {
    latitude: dto.lat,
    longitude: dto.lng,
    radiusM: dto.radius_m,
    geometry: dto.geometry,
    observedFrom: dto.from,
    observedTo: dto.to,
    scientificName: dto.taxon,
    taxonId: undefined,
    providers,
    qualityFilters: {
      researchGradeOnly: dto.quality === 'research',
      requireCoordinates: true,
      excludeCaptiveCultivated: dto.quality === 'research',
      excludeGeospatialIssues: true,
    },
    limit: dto.limit,
    cursor: dto.cursor,
    mode: dto.mode ?? 'detail',
  }
}

/** DTO público sin payloads crudos del proveedor. */
export function toPublicOccurrenceDto(occurrence: BiodiversityOccurrence) {
  const dto: Record<string, unknown> = {
    source: occurrence.source,
    source_occurrence_id: occurrence.sourceOccurrenceId,
    scientific_name: occurrence.scientificName,
    canonical_name: occurrence.canonicalName,
    common_name: occurrence.commonName,
    taxon_rank: occurrence.taxonRank,
    observed_at: occurrence.observedAt,
    coordinates_obscured: occurrence.coordinatesObscured,
    privacy_level: occurrence.privacyLevel,
    quality_grade: occurrence.qualityGrade,
    basis_of_record: occurrence.basisOfRecord,
    record_kind: occurrence.recordKind,
    license: occurrence.license,
    attribution: occurrence.attribution,
    source_url: occurrence.sourceUrl,
    dataset_title: occurrence.datasetTitle,
    possible_duplicate: occurrence.possibleDuplicate,
    duplicate_candidate: occurrence.duplicateCandidate ?? false,
    duplicate_group_id: occurrence.duplicateGroupId,
    deduplication_confidence: occurrence.deduplicationConfidence,
    deduplication_reason: occurrence.deduplicationReason,
    quality_warnings: occurrence.qualityWarnings,
    fetched_at: occurrence.fetchedAt,
  }

  if (canExposeExactLocation(occurrence.privacyLevel)) {
    dto.latitude = occurrence.latitude
    dto.longitude = occurrence.longitude
    dto.coordinate_uncertainty_m = occurrence.coordinateUncertaintyM
  }

  return dto
}

/** Modo summary: sin coordenadas ni metadata interna. */
export function toPublicOccurrenceSummaryDto(occurrence: BiodiversityOccurrence) {
  return {
    source: occurrence.source,
    source_occurrence_id: occurrence.sourceOccurrenceId,
    scientific_name: occurrence.scientificName,
    common_name: occurrence.commonName,
    observed_at: occurrence.observedAt,
    privacy_level: occurrence.privacyLevel,
    quality_grade: occurrence.qualityGrade,
    record_kind: occurrence.recordKind,
    possible_duplicate: occurrence.possibleDuplicate,
    license: occurrence.license,
    source_url: occurrence.sourceUrl,
    attribution: occurrence.attribution,
  }
}

export function parseBiodiversitySearchQuery(
  searchParams: URLSearchParams,
): { ok: true; data: BiodiversitySearchQueryDto } | { ok: false; error: string } {
  const raw = Object.fromEntries(searchParams.entries())
  const parsed = biodiversitySearchQuerySchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  return { ok: true, data: parsed.data }
}

export function parseBiodiversityTaxonResolveQuery(
  searchParams: URLSearchParams,
): { ok: true; data: BiodiversityTaxonResolveDto } | { ok: false; error: string } {
  const raw = Object.fromEntries(searchParams.entries())
  const parsed = biodiversityTaxonResolveSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  if (!parsed.data.name && !parsed.data.taxon_id) {
    return { ok: false, error: 'Se requiere name o taxon_id' }
  }
  return { ok: true, data: parsed.data }
}
