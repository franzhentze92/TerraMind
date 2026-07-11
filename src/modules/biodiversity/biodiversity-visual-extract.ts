import type { BiodiversityOccurrence } from './biodiversity.types'
import { evaluateImageDisplay } from './biodiversity-media-license'
import {
  BIODIVERSITY_TAXON_GROUP_LABELS,
  resolveBiodiversityTaxonGroup,
} from './biodiversity-taxon-groups'
import { mapInatLicenseCode } from './providers/inaturalist/inaturalist-license'
import type { InatObservation } from './providers/inaturalist/inaturalist.types'
import type { GbifOccurrenceRecord } from './providers/gbif/gbif.types'
import type { BiodiversityObservationVisual } from './biodiversity-visual.types'

function inatPhotoUrls(photos?: Array<{ url?: string }>): { image?: string; thumb?: string } {
  const raw = photos?.[0]?.url
  if (!raw) return {}
  const base = raw.replace(/\/(original|large|medium|small|square)\.(jpg|jpeg|png)$/i, '')
  return {
    image: `${base}/medium.jpg`,
    thumb: `${base}/square.jpg`,
  }
}

function gbifImageUrls(media?: Array<{ identifier?: string; type?: string }> | { identifier?: string; type?: string }): {
  image?: string
  thumb?: string
} {
  const items = Array.isArray(media) ? media : media ? [media] : []
  const still = items.find(
    (m) =>
      m.identifier &&
      (!m.type || m.type.toLowerCase().includes('still') || m.type.toLowerCase() === 'image'),
  )
  if (!still?.identifier) return {}
  return { image: still.identifier, thumb: still.identifier }
}

function privacyLabel(level: BiodiversityOccurrence['privacyLevel'], obscured: boolean): string {
  if (level === 'private_unavailable' || obscured) return 'Ubicación generalizada u oculta'
  if (level === 'sensitive_generalized' || level === 'public_generalized') {
    return 'Ubicación generalizada'
  }
  return 'Ubicación pública en fuente'
}

export function buildInaturalistVisualMedia(
  obs: InatObservation,
  license?: string,
): BiodiversityOccurrence['visualMedia'] | undefined {
  const urls = inatPhotoUrls(obs.photos)
  if (!urls.image) return undefined
  const imageEval = evaluateImageDisplay(license ?? mapInatLicenseCode(obs.license_code))
  if (!imageEval.allowed) return undefined
  const gallery = (obs.photos ?? [])
    .slice(0, 4)
    .map((p) => {
      const u = inatPhotoUrls([p])
      return u.image
        ? { imageUrl: u.image, thumbnailUrl: u.thumb ?? u.image, imageLicense: imageEval.license }
        : null
    })
    .filter((g): g is NonNullable<typeof g> => g !== null)
  return {
    imageUrl: urls.image,
    thumbnailUrl: urls.thumb ?? urls.image,
    imageLicense: imageEval.license,
    gallery,
  }
}

export function buildGbifVisualMedia(
  record: GbifOccurrenceRecord,
): BiodiversityOccurrence['visualMedia'] | undefined {
  const urls = gbifImageUrls(record.media)
  if (!urls.image) return undefined
  const imageEval = evaluateImageDisplay(record.license)
  if (!imageEval.allowed) return undefined
  return {
    imageUrl: urls.image,
    thumbnailUrl: urls.thumb ?? urls.image,
    imageLicense: imageEval.license,
    gallery: [
      {
        imageUrl: urls.image,
        thumbnailUrl: urls.thumb ?? urls.image,
        imageLicense: imageEval.license,
      },
    ],
  }
}

export function occurrenceToVisual(
  occurrence: BiodiversityOccurrence,
  zone: { code: string; name: string },
  isRecent: boolean,
): BiodiversityObservationVisual | null {
  if (!occurrence.visualMedia) return null
  const group = resolveBiodiversityTaxonGroup(occurrence)
  return {
    source: occurrence.source,
    sourceOccurrenceId: occurrence.sourceOccurrenceId,
    sourceTaxonId: occurrence.sourceTaxonId,
    imageUrl: occurrence.visualMedia.imageUrl,
    thumbnailUrl: occurrence.visualMedia.thumbnailUrl,
    imageLicense: occurrence.visualMedia.imageLicense,
    imageAttribution: occurrence.attribution ?? '',
    observationUrl: occurrence.sourceUrl,
    taxonName: occurrence.scientificName,
    commonName: occurrence.commonName,
    taxonomicGroup: group,
    taxonomicGroupLabel: BIODIVERSITY_TAXON_GROUP_LABELS[group],
    observedAt: occurrence.observedAt,
    zoneCode: zone.code,
    zoneName: zone.name,
    qualityGrade: occurrence.qualityGrade,
    privacyLevel: occurrence.privacyLevel,
    coordinatesPrivacyLabel: privacyLabel(occurrence.privacyLevel, occurrence.coordinatesObscured),
    isRecent,
    isVisualCandidate: true,
    sortScore: 0,
  }
}

export function toPublicVisualDto(
  visual: BiodiversityObservationVisual,
): BiodiversityObservationVisual {
  return visual
}
