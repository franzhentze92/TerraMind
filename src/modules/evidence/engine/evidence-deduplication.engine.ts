import type { EvidenceDeduplicationResult } from '@/modules/evidence/evidence-intake.types'

export interface ExistingAssetFingerprint {
  submission_id: string
  asset_id: string
  checksum_sha256: string
  mission_id: string
  submitted_by_id: string
  submitted_at: string
  original_filename: string
}

export function evaluateDeduplication(input: {
  mission_id: string
  submitted_by_id: string
  checksum_sha256: string | null
  original_filename: string
  submitted_at: string
  existing_assets: ExistingAssetFingerprint[]
}): EvidenceDeduplicationResult {
  if (!input.checksum_sha256) {
    return {
      duplicate_class: 'none',
      duplicate_of_submission_id: null,
      duplicate_of_asset_id: null,
      reasons: ['Sin checksum; deduplicación diferida'],
    }
  }

  const exact = input.existing_assets.find(
    (a) =>
      a.checksum_sha256 === input.checksum_sha256 &&
      a.mission_id === input.mission_id &&
      a.submitted_by_id === input.submitted_by_id,
  )
  if (exact) {
    return {
      duplicate_class: 'exact_duplicate',
      duplicate_of_submission_id: exact.submission_id,
      duplicate_of_asset_id: exact.asset_id,
      reasons: ['Duplicado exacto por checksum, misión y submitter'],
    }
  }

  const sameFile = input.existing_assets.find(
    (a) => a.checksum_sha256 === input.checksum_sha256 && a.mission_id === input.mission_id,
  )
  if (sameFile) {
    return {
      duplicate_class: 'possible_duplicate',
      duplicate_of_submission_id: sameFile.submission_id,
      duplicate_of_asset_id: sameFile.asset_id,
      reasons: ['Posible duplicado: mismo archivo en la misión'],
    }
  }

  const sameChecksum = input.existing_assets.find(
    (a) => a.checksum_sha256 === input.checksum_sha256,
  )
  if (sameChecksum) {
    const submittedMs = Date.parse(input.submitted_at)
    const existingMs = Date.parse(sameChecksum.submitted_at)
    if (Math.abs(submittedMs - existingMs) < 5 * 60 * 1000) {
      return {
        duplicate_class: 'possible_duplicate',
        duplicate_of_submission_id: sameChecksum.submission_id,
        duplicate_of_asset_id: sameChecksum.asset_id,
        reasons: ['Posible duplicado: checksum y timestamps cercanos'],
      }
    }
    return {
      duplicate_class: 'related_distinct',
      duplicate_of_submission_id: sameChecksum.submission_id,
      duplicate_of_asset_id: sameChecksum.asset_id,
      reasons: ['Archivo relacionado pero distinto contexto'],
    }
  }

  const sameName = input.existing_assets.find(
    (a) =>
      a.original_filename === input.original_filename &&
      a.mission_id === input.mission_id &&
      Math.abs(Date.parse(input.submitted_at) - Date.parse(a.submitted_at)) < 60 * 1000,
  )
  if (sameName) {
    return {
      duplicate_class: 'possible_duplicate',
      duplicate_of_submission_id: sameName.submission_id,
      duplicate_of_asset_id: sameName.asset_id,
      reasons: ['Posible duplicado: mismo nombre y timestamp cercano'],
    }
  }

  return {
    duplicate_class: 'none',
    duplicate_of_submission_id: null,
    duplicate_of_asset_id: null,
    reasons: ['Sin duplicado detectado'],
  }
}
