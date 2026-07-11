import { METADATA_REQUIREMENTS_BY_TYPE } from '@/modules/evidence/config/fire-evidence-intake.config'
import type { EvidenceSubmissionStatus } from '@/modules/evidence/evidence-intake.types'
import { evaluateDeduplication, type ExistingAssetFingerprint } from './evidence-deduplication.engine'
import type { EvidenceDeduplicationResult } from '@/modules/evidence/evidence-intake.types'
import { evaluateAssetIntegrity } from './evidence-integrity.engine'
import { evaluateRequirementLinks } from './evidence-requirement-matching.engine'

function pointInPolygon(
  point: [number, number],
  polygon: number[][][],
): boolean {
  const [x, y] = point
  const ring = polygon[0]
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[1] - a[1])
  const dLng = toRad(b[0] - a[0])
  const lat1 = toRad(a[1])
  const lat2 = toRad(b[1])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function evaluateLocationContext(input: {
  declared_location: { type: 'Point'; coordinates: [number, number] } | null
  device_location: { type: 'Point'; coordinates: [number, number] } | null
  mission_area: { type: string; coordinates: number[][][] } | null
}): {
  outside_mission_area: boolean
  discrepancy_m: number | null
  warnings: string[]
} {
  const warnings: string[] = []
  const loc = input.declared_location ?? input.device_location
  if (!loc) {
    return { outside_mission_area: false, discrepancy_m: null, warnings }
  }

  let outside = false
  if (input.mission_area?.type === 'Polygon') {
    outside = !pointInPolygon(loc.coordinates, input.mission_area.coordinates)
    if (outside) {
      warnings.push('Ubicación fuera del área de misión; conservada para validación posterior')
    }
  }

  let discrepancy: number | null = null
  if (input.declared_location && input.device_location) {
    discrepancy = haversineM(
      input.declared_location.coordinates,
      input.device_location.coordinates,
    )
    if (discrepancy > 100) {
      warnings.push(`Discrepancia ubicación declarada/dispositivo: ${Math.round(discrepancy)} m`)
    }
  }

  return { outside_mission_area: outside, discrepancy_m: discrepancy, warnings }
}

export function detectMissingMetadata(input: {
  evidence_type: string
  captured_at?: string | null
  location_geometry?: unknown
  has_observation: boolean
  has_assets: boolean
}): string[] {
  const required = METADATA_REQUIREMENTS_BY_TYPE[input.evidence_type] ?? []
  const missing: string[] = []
  for (const field of required) {
    if (field === 'captured_at' && !input.captured_at) missing.push(field)
    if (field === 'location' && !input.location_geometry) missing.push(field)
    if (field === 'observation_schema' && !input.has_observation) missing.push(field)
  }
  if (input.evidence_type !== 'structured_observation' && !input.has_assets && required.length > 0) {
    if (!missing.includes('asset')) missing.push('asset')
  }
  return missing
}

export function evaluateEvidenceProcessing(input: {
  submission_id: string
  mission_id: string
  submitted_by_id: string
  submitted_at: string
  evidence_type: string
  captured_at?: string | null
  location_geometry?: { type: 'Point'; coordinates: [number, number] } | null
  device_location_geometry?: { type: 'Point'; coordinates: [number, number] } | null
  mission_area: { type: string; coordinates: number[][][] } | null
  requirements: import('@/modules/evidence/evidence-intake.types').EvidenceRequirementSnapshot[]
  explicit_requirement_ids?: string[]
  assets: Array<{
    original_filename: string
    mime_type: string
    size_bytes: number
    checksum_sha256?: string | null
  }>
  has_observation: boolean
  existing_assets: ExistingAssetFingerprint[]
}): import('@/modules/evidence/evidence-intake.types').EvidenceProcessingResult {
  const warnings: string[] = []
  const reasons: string[] = []

  if (input.assets.length === 0 && !input.has_observation) {
    return {
      ok: false,
      submission_status: 'incomplete',
      integrity: {
        valid: false,
        checksum_valid: false,
        size_valid: false,
        mime_valid: false,
        extension_mismatch: false,
        reasons: ['Sin archivos ni observación'],
        warnings: [],
      },
      deduplication: {
        duplicate_class: 'none',
        duplicate_of_submission_id: null,
        duplicate_of_asset_id: null,
        reasons: [],
      },
      requirement_links: [],
      missing_metadata: ['asset'],
      location_outside_mission_area: false,
      location_discrepancy_m: null,
      reasons: ['Submission incompleta'],
      warnings: [],
    }
  }

  const missing_metadata = detectMissingMetadata({
    evidence_type: input.evidence_type,
    captured_at: input.captured_at,
    location_geometry: input.location_geometry,
    has_observation: input.has_observation,
    has_assets: input.assets.length > 0,
  })

  const locationCtx = evaluateLocationContext({
    declared_location: input.location_geometry ?? null,
    device_location: input.device_location_geometry ?? null,
    mission_area: input.mission_area,
  })
  warnings.push(...locationCtx.warnings)

  let integrity = {
    valid: true,
    checksum_valid: true,
    size_valid: true,
    mime_valid: true,
    extension_mismatch: false,
    reasons: [] as string[],
    warnings: [] as string[],
  }
  let deduplication: EvidenceDeduplicationResult = {
    duplicate_class: 'none',
    duplicate_of_submission_id: null,
    duplicate_of_asset_id: null,
    reasons: [],
  }

  if (input.assets.length > 0) {
    const primary = input.assets[0]
    integrity = evaluateAssetIntegrity({
      evidence_type: input.evidence_type,
      ...primary,
    })
    deduplication = evaluateDeduplication({
      mission_id: input.mission_id,
      submitted_by_id: input.submitted_by_id,
      checksum_sha256: primary.checksum_sha256 ?? null,
      original_filename: primary.original_filename,
      submitted_at: input.submitted_at,
      existing_assets: input.existing_assets,
    })
    warnings.push(...integrity.warnings)
    reasons.push(...integrity.reasons)
    reasons.push(...deduplication.reasons)
  }

  if (deduplication.duplicate_class === 'exact_duplicate') {
    return {
      ok: true,
      submission_status: 'duplicate',
      integrity,
      deduplication,
      requirement_links: [],
      missing_metadata,
      location_outside_mission_area: locationCtx.outside_mission_area,
      location_discrepancy_m: locationCtx.discrepancy_m,
      reasons: ['Duplicado exacto; intento conservado en auditoría'],
      warnings,
    }
  }

  if (!integrity.valid && input.assets.length > 0) {
    return {
      ok: false,
      submission_status: 'unsupported',
      integrity,
      deduplication,
      requirement_links: [],
      missing_metadata,
      location_outside_mission_area: locationCtx.outside_mission_area,
      location_discrepancy_m: locationCtx.discrepancy_m,
      reasons,
      warnings,
    }
  }

  const requirement_links = evaluateRequirementLinks({
    evidence_type: input.evidence_type,
    requirements: input.requirements,
    explicit_requirement_ids: input.explicit_requirement_ids,
    has_assets: input.assets.length > 0,
    has_observation: input.has_observation,
    missing_metadata,
  })

  let submission_status: EvidenceSubmissionStatus = 'ready_for_validation'
  if (missing_metadata.length > 0) {
    submission_status = 'incomplete'
    reasons.push(`Metadatos incompletos: ${missing_metadata.join(', ')}`)
  }
  warnings.push('Completar intake no valida evidencia automáticamente')

  return {
    ok: true,
    submission_status,
    integrity,
    deduplication,
    requirement_links,
    missing_metadata,
    location_outside_mission_area: locationCtx.outside_mission_area,
    location_discrepancy_m: locationCtx.discrepancy_m,
    reasons: reasons.length ? reasons : ['Evidencia lista para validación'],
    warnings,
  }
}
