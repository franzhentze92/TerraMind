import type {
  CoverageStatus,
  LocalEvidenceRecord,
  LocalEvidenceRequirementLink,
  ParsedEvidenceRequirement,
  RequirementCoverageSummary,
  RequirementMatchType,
} from '@/modules/field-operations/offline-evidence/offline-evidence.types'

function normalizeEvidenceType(value: string): string {
  return value.trim().toLowerCase()
}

export function matchRecordToRequirements(
  record: LocalEvidenceRecord,
  requirements: ParsedEvidenceRequirement[],
): LocalEvidenceRequirementLink[] {
  const links: LocalEvidenceRequirementLink[] = []
  for (const req of requirements) {
    const typeMatch = normalizeEvidenceType(req.evidence_type) === normalizeEvidenceType(record.evidence_type)
    const taskScoped = record.task_id
    let match_type: RequirementMatchType = 'not_matched'
    let match_score = 0
    const reasons: string[] = []

    if (typeMatch) {
      match_type = 'matched'
      match_score = 80
      reasons.push('evidence_type_match')
    } else if (
      record.evidence_type === 'timestamped_photo' &&
      req.evidence_type === 'georeferenced_photo'
    ) {
      match_type = 'partial_match'
      match_score = 45
      reasons.push('photo_type_partial')
    } else if (record.form_response_id && req.required) {
      match_type = 'potential_match'
      match_score = 30
      reasons.push('form_response_context')
    }

    if (!typeMatch && match_type === 'not_matched') continue

    let coverage_status: CoverageStatus = 'unknown'
    if (match_type === 'matched') coverage_status = 'partial'
    if (match_type === 'partial_match') coverage_status = 'partial'

    if (record.location?.permission === 'denied' && req.required_metadata.includes('lat')) {
      reasons.push('gps_denied_metadata_gap')
      coverage_status = 'partial'
    }

    links.push({
      local_evidence_id: record.local_evidence_id,
      requirement_id: req.id,
      match_type,
      match_score,
      match_reasons: [...reasons, `task:${taskScoped}`],
      coverage_status,
    })
  }
  return links
}

export function computeRequirementCoverage(
  requirements: ParsedEvidenceRequirement[],
  records: LocalEvidenceRecord[],
  links: LocalEvidenceRequirementLink[],
): RequirementCoverageSummary[] {
  return requirements.map((req) => {
    const matchedLinks = links.filter(
      (l) =>
        l.requirement_id === req.id &&
        l.match_type !== 'not_matched' &&
        records.some(
          (r) =>
            r.local_evidence_id === l.local_evidence_id &&
            !['corrupted', 'deleted_pending_sync', 'duplicate', 'superseded'].includes(r.status),
        ),
    )
    const matchedRecords = records.filter((r) =>
      matchedLinks.some((l) => l.local_evidence_id === r.local_evidence_id),
    )
    const captured_count = matchedRecords.length
    const missing_count = Math.max(0, req.minimum_count - captured_count)
    const warnings: string[] = []
    const metadata_missing: string[] = []

    for (const key of req.required_metadata) {
      const hasMeta = matchedRecords.some((r) => {
        if (key === 'lat' || key === 'lon') return r.location?.lat != null && r.location?.lng != null
        if (key === 'timestamp') return Boolean(r.device_timestamp)
        return Boolean(r.metadata[key])
      })
      if (!hasMeta) metadata_missing.push(key)
    }

    if (metadata_missing.includes('lat') || metadata_missing.includes('lon')) {
      warnings.push('GPS accuracy warning')
    }

    let coverage_status: CoverageStatus = 'none'
    if (captured_count === 0) coverage_status = 'none'
    else if (captured_count < req.minimum_count) coverage_status = 'partial'
    else if (metadata_missing.length > 0) {
      coverage_status = 'partial'
      warnings.push('metadata_incomplete')
    } else coverage_status = 'complete_preliminary'

    if (!req.required && captured_count === 0) coverage_status = 'unknown'

    return {
      requirement_id: req.id,
      evidence_type: req.evidence_type,
      minimum_count: req.minimum_count,
      captured_count,
      missing_count,
      coverage_status,
      warnings,
      required_metadata: req.required_metadata,
      metadata_missing,
    }
  })
}

export function parseRequirementsFromPackage(
  payloads: Array<{ path: string; content: string }>,
): ParsedEvidenceRequirement[] {
  const file = payloads.find((p) => p.path === 'evidence-requirements.json')
  if (!file) return []
  try {
    const rows = JSON.parse(file.content) as Array<Record<string, unknown>>
    return rows.map((r) => ({
      id: String(r.id),
      evidence_type: String(r.evidence_type),
      required: Boolean(r.required),
      minimum_count: Number(r.minimum_count ?? 1),
      required_metadata: (r.required_metadata as string[]) ?? [],
      verification_need_id: r.verification_need_id ? String(r.verification_need_id) : null,
    }))
  } catch {
    return []
  }
}
