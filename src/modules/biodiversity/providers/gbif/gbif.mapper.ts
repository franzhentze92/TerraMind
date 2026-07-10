import type {
  BiodiversityOccurrence,
  BiodiversityRecordKind,
  BiodiversityTaxon,
} from '../../biodiversity.types'
import { BIODIVERSITY_CONFIG } from '../../config/biodiversity.config'
import {
  detectGbifInaturalistProvenance,
  extractInaturalistIdFromGbifRecord,
} from '../../biodiversity-gbif-inaturalist-provenance'
import { evaluateOccurrenceLicense } from '../../biodiversity-license'
import { applyBiodiversityPrivacyPolicy } from '../../biodiversity-privacy'
import { buildGbifVisualMedia } from '../../biodiversity-visual-extract'
import type {
  GbifOccurrenceRecord,
  GbifSpeciesMatchResponse,
  GbifSpeciesRecord,
} from './gbif.types'

const INAT_URL_RE = /inaturalist\.org\/observations\/(\d+)/i

export function inferGbifRecordKind(record: GbifOccurrenceRecord): BiodiversityRecordKind {
  if (record.references && INAT_URL_RE.test(record.references)) {
    return 'citizen_science_observation'
  }
  if (record.datasetKey === BIODIVERSITY_CONFIG.inaturalist.gbifDatasetKey) {
    return 'citizen_science_observation'
  }

  const basis = (record.basisOfRecord ?? '').toUpperCase()
  if (basis === 'HUMAN_OBSERVATION') return 'human_observation'
  if (basis === 'MACHINE_OBSERVATION') return 'machine_observation'
  if (basis === 'PRESERVED_SPECIMEN' || basis === 'FOSSIL_SPECIMEN' || basis === 'LIVING_SPECIMEN') {
    return 'preserved_specimen'
  }
  if (basis === 'MATERIAL_SAMPLE' || record.catalogNumber || record.collectionCode) {
    return 'collection_record'
  }
  const year = record.year
  if (year && year < new Date().getFullYear() - 5) return 'historical_presence'
  return 'recent_observation'
}

function buildGbifAttribution(record: GbifOccurrenceRecord): string {
  const parts = [
    record.recordedBy,
    record.rightsHolder,
    record.institutionCode,
    record.datasetName,
    record.publishingOrg,
  ].filter(Boolean)
  return parts.join(' · ') || 'GBIF occurrence record'
}

function buildGbifSourceUrl(key: number | string): string {
  return `https://www.gbif.org/occurrence/${key}`
}

export function mapGbifOccurrence(record: GbifOccurrenceRecord, fetchedAt: string): BiodiversityOccurrence {
  const licenseEval = evaluateOccurrenceLicense({
    license: record.license,
    source: 'gbif',
    hasMedia: Boolean(record.media?.length),
  })

  const occurrence: BiodiversityOccurrence = {
    source: 'gbif',
    sourceOccurrenceId: String(record.key),
    sourceDatasetId: record.datasetKey,
    sourceTaxonId: record.taxonKey ? String(record.taxonKey) : undefined,
    scientificName: record.scientificName ?? 'Unknown',
    canonicalName: record.canonicalName,
    commonName: record.vernacularName,
    taxonRank: record.taxonRank,
    kingdom: record.kingdom,
    phylum: record.phylum,
    className: record.class,
    orderName: record.order,
    family: record.family,
    genus: record.genus,
    species: record.species,
    observedAt: record.eventDate,
    eventDatePrecision: record.day ? 'day' : record.month ? 'month' : record.year ? 'year' : undefined,
    latitude: record.decimalLatitude,
    longitude: record.decimalLongitude,
    coordinateUncertaintyM: record.coordinateUncertaintyInMeters,
    coordinatesObscured: false,
    geoprivacy: undefined,
    privacyLevel: 'public_exact',
    qualityGrade: record.identificationVerificationStatus,
    basisOfRecord: record.basisOfRecord,
    occurrenceStatus: record.occurrenceStatus,
    captiveOrCultivated:
      record.establishmentMeans?.toLowerCase().includes('cultivated') ||
      record.establishmentMeans?.toLowerCase().includes('captive') ||
      false,
    establishmentMeans: record.establishmentMeans,
    license: record.license,
    attribution: buildGbifAttribution(record),
    sourceUrl: record.references?.startsWith('http')
      ? record.references
      : buildGbifSourceUrl(record.key),
    sourceReference: record.references,
    dwcOccurrenceId: record.occurrenceID,
    datasetTitle: record.datasetName,
    publishingOrganization: record.publishingOrg,
    recordKind: inferGbifRecordKind(record),
    possibleDuplicate: false,
    fetchedAt,
    qualityWarnings: [...(record.issues ?? []), ...licenseEval.warnings],
  }

  if (record.hasGeospatialIssue) {
    occurrence.qualityWarnings.push('has_geospatial_issue')
  }

  occurrence.gbifInaturalistProvenance = detectGbifInaturalistProvenance(occurrence)

  const visualMedia = buildGbifVisualMedia(record)
  if (visualMedia) occurrence.visualMedia = visualMedia

  return applyBiodiversityPrivacyPolicy(occurrence)
}

export function mapGbifSpeciesMatch(
  match: GbifSpeciesMatchResponse,
  fetchedAt: string,
): BiodiversityTaxon | null {
  if (!match.usageKey || !match.scientificName) return null
  return {
    source: 'gbif',
    sourceTaxonId: String(match.usageKey),
    scientificName: match.scientificName,
    canonicalName: match.canonicalName,
    commonName: match.vernacularName,
    taxonRank: match.rank,
    kingdom: match.kingdom,
    phylum: match.phylum,
    className: match.class,
    orderName: match.order,
    family: match.family,
    genus: match.genus,
    species: match.species,
    matchType: match.matchType,
    confidence: match.confidence,
    sourceUrl: `https://www.gbif.org/species/${match.usageKey}`,
    fetchedAt,
  }
}

export function mapGbifSpeciesRecord(record: GbifSpeciesRecord, fetchedAt: string): BiodiversityTaxon {
  const common =
    record.vernacularNames?.find((v) => v.language?.startsWith('es'))?.vernacularName ??
    record.vernacularNames?.[0]?.vernacularName
  return {
    source: 'gbif',
    sourceTaxonId: String(record.key),
    scientificName: record.scientificName,
    canonicalName: record.canonicalName,
    commonName: common,
    taxonRank: record.rank,
    kingdom: record.kingdom,
    phylum: record.phylum,
    className: record.class,
    orderName: record.order,
    family: record.family,
    genus: record.genus,
    species: record.species,
    sourceUrl: `https://www.gbif.org/species/${record.key}`,
    fetchedAt,
  }
}

export function extractInaturalistIdFromGbif(record: GbifOccurrenceRecord): string | null {
  return extractInaturalistIdFromGbifRecord(record)
}

export function encodeGbifCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url')
}

export function decodeGbifCursor(cursor?: string): number {
  if (!cursor) return 0
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: number }
    return typeof parsed.offset === 'number' && parsed.offset >= 0 ? parsed.offset : 0
  } catch {
    return 0
  }
}
