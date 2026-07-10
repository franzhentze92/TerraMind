import type { BiodiversityOccurrence, BiodiversityTaxon } from '../../biodiversity.types'
import { evaluateOccurrenceLicense } from '../../biodiversity-license'
import { applyBiodiversityPrivacyPolicy } from '../../biodiversity-privacy'
import type { InatObservation, InatTaxon } from './inaturalist.types'

const LICENSE_MAP: Record<string, string> = {
  'cc0': 'CC0-1.0',
  'cc-by': 'CC-BY-4.0',
  'cc-by-nc': 'CC-BY-NC-4.0',
  'cc-by-sa': 'CC-BY-SA-4.0',
  'cc-by-nd': 'CC-BY-ND-4.0',
  'cc-by-nc-sa': 'CC-BY-NC-SA-4.0',
  'cc-by-nc-nd': 'CC-BY-NC-ND-4.0',
}

export function mapInatLicenseCode(code?: string | null): string | undefined {
  if (!code) return undefined
  const normalized = code.toLowerCase().trim()
  return LICENSE_MAP[normalized] ?? code
}

export function mapInaturalistTaxon(taxon: InatTaxon, fetchedAt: string): BiodiversityTaxon {
  return {
    source: 'inaturalist',
    sourceTaxonId: String(taxon.id),
    scientificName: taxon.name ?? 'Unknown',
    commonName: taxon.preferred_common_name,
    taxonRank: taxon.rank,
    kingdom: taxon.iconic_taxon_name,
    sourceUrl: `https://www.inaturalist.org/taxa/${taxon.id}`,
    fetchedAt,
  }
}

function buildInatAttribution(obs: InatObservation): string {
  const observer = obs.user?.name || obs.user?.login
  const taxon = obs.taxon?.name
  const parts = [observer, taxon].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'iNaturalist observation'
}

export function mapInaturalistObservation(
  obs: InatObservation,
  fetchedAt: string,
): BiodiversityOccurrence {
  const license = mapInatLicenseCode(obs.license_code)
  const licenseEval = evaluateOccurrenceLicense({
    license,
    source: 'inaturalist',
    hasMedia: Boolean(obs.photos?.length || obs.sounds?.length),
  })

  const latRaw = obs.latitude ?? obs.location?.[0] ?? obs.geojson?.coordinates?.[1]
  const lngRaw = obs.longitude ?? obs.location?.[1] ?? obs.geojson?.coordinates?.[0]
  const lat = latRaw != null && latRaw !== '' ? Number(latRaw) : undefined
  const lng = lngRaw != null && lngRaw !== '' ? Number(lngRaw) : undefined

  const occurrence: BiodiversityOccurrence = {
    source: 'inaturalist',
    sourceOccurrenceId: String(obs.id),
    sourceTaxonId: obs.taxon?.id ? String(obs.taxon.id) : undefined,
    scientificName: obs.taxon?.name ?? 'Unknown',
    commonName: obs.taxon?.preferred_common_name,
    taxonRank: obs.taxon?.rank,
    kingdom: obs.taxon?.iconic_taxon_name,
    observedAt: obs.time_observed_at ?? obs.observed_on,
    eventDatePrecision: obs.time_observed_at ? 'instant' : 'day',
    dwcOccurrenceId: obs.uuid,
    latitude: lat !== undefined && Number.isFinite(lat) ? lat : undefined,
    longitude: lng !== undefined && Number.isFinite(lng) ? lng : undefined,
    coordinateUncertaintyM: obs.positional_accuracy ?? undefined,
    coordinatesObscured: Boolean(obs.obscured),
    geoprivacy: obs.geoprivacy ?? obs.taxon_geoprivacy ?? undefined,
    privacyLevel: 'public_exact',
    qualityGrade: obs.quality_grade,
    basisOfRecord: 'HUMAN_OBSERVATION',
    occurrenceStatus: 'PRESENT',
    captiveOrCultivated: Boolean(obs.captive),
    license,
    attribution: buildInatAttribution(obs),
    sourceUrl: obs.uri ?? obs.url ?? `https://www.inaturalist.org/observations/${obs.id}`,
    recordKind: 'citizen_science_observation',
    possibleDuplicate: false,
    fetchedAt,
    qualityWarnings: licenseEval.warnings,
  }

  if (obs.quality_grade === 'casual') {
    occurrence.qualityWarnings.push('casual_grade')
  }

  return applyBiodiversityPrivacyPolicy(occurrence)
}

export function encodeInatCursor(page: number): string {
  return Buffer.from(JSON.stringify({ page }), 'utf8').toString('base64url')
}

export function decodeInatCursor(cursor?: string): number {
  if (!cursor) return 1
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { page?: number }
    return typeof parsed.page === 'number' && parsed.page >= 1 ? parsed.page : 1
  } catch {
    return 1
  }
}
