import {
  CONFLICT_OBSERVATION_FIELDS,
  SCORE_WEIGHTS,
  ACCEPTED_MIN_OVERALL,
  ACCEPTED_WITH_LIMITATIONS_MIN,
  STRENGTH_THRESHOLDS,
  VALIDATION_MODEL_VERSION,
} from '@/modules/evidence/config/fire-evidence-validation.config'
import { assertSafeValidationCopy } from '@/modules/evidence/validation/evidence-validation-copy-guard'
import type {
  ConflictFlagResult,
  EvidenceStrength,
  RequirementLinkValidation,
  RejectionReasonCode,
  ValidationCheckResult,
  ValidationDecisionResult,
  ValidationSnapshot,
  ValidationStatus,
  ValidCoverageStatus,
} from '@/modules/evidence/validation/evidence-validation.types'
import { hashValidationContext } from '@/modules/evidence/validation/evidence-validation.types'

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function hoursBetween(a: string | null, b: string): number | null {
  if (!a) return null
  return Math.abs(Date.parse(b) - Date.parse(a)) / 3_600_000
}

function pointDistanceM(
  a: [number, number],
  b: [number, number],
): number {
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

function missionCentroid(
  area: { type: string; coordinates: number[][][] } | null,
): [number, number] | null {
  if (!area || area.type !== 'Polygon') return null
  const ring = area.coordinates[0]
  let sx = 0
  let sy = 0
  for (const [lng, lat] of ring) {
    sx += lng
    sy += lat
  }
  return [sx / ring.length, sy / ring.length]
}

function strengthFromScore(overall: number, semantic: number): EvidenceStrength {
  const adjusted = overall * 0.6 + semantic * 0.4
  if (adjusted >= STRENGTH_THRESHOLDS.very_strong) return 'very_strong'
  if (adjusted >= STRENGTH_THRESHOLDS.strong) return 'strong'
  if (adjusted >= STRENGTH_THRESHOLDS.moderate) return 'moderate'
  if (adjusted >= STRENGTH_THRESHOLDS.low) return 'low'
  return 'very_low'
}

function coverageFromDecision(
  status: ValidationStatus,
  matchType: string,
): ValidCoverageStatus {
  if (status === 'rejected' || status === 'withdrawn') return 'invalid_coverage'
  if (status === 'superseded') return 'superseded_coverage'
  if (status === 'inconclusive') return 'inconclusive_coverage'
  if (status === 'accepted_with_limitations' || matchType === 'partial_match') {
    return 'valid_partial_coverage'
  }
  if (status === 'accepted' && ['matched', 'potential_match'].includes(matchType)) {
    return matchType === 'matched' ? 'valid_coverage' : 'valid_partial_coverage'
  }
  return 'inconclusive_coverage'
}

export function detectConflicts(
  snapshot: ValidationSnapshot,
): ConflictFlagResult[] {
  const flags: ConflictFlagResult[] = []
  const obs = snapshot.observation
  if (!obs) return flags

  for (const peer of snapshot.peer_submissions) {
    if (!peer.observation || peer.submission_id === snapshot.submission_id) continue
    if (peer.validation_status && ['rejected', 'withdrawn', 'superseded'].includes(peer.validation_status)) {
      continue
    }
    for (const field of CONFLICT_OBSERVATION_FIELDS) {
      const a = obs[field]
      const b = peer.observation[field]
      if (
        typeof a === 'string' &&
        typeof b === 'string' &&
        a !== 'uncertain' &&
        b !== 'uncertain' &&
        a !== b
      ) {
        flags.push({
          submission_id_a: snapshot.submission_id,
          submission_id_b: peer.submission_id,
          conflict_type: 'observation_contradiction',
          conflict_field: field,
          description: `Contradicción potencial en ${field}: ${a} vs ${b}`,
        })
      }
    }
  }
  return flags
}

export function evaluateEvidenceValidation(snapshot: ValidationSnapshot): ValidationDecisionResult {
  const checks: ValidationCheckResult[] = []
  const limitations: string[] = []
  const decision_rules: string[] = []
  const recommended_follow_up: string[] = []
  const warnings: string[] = []

  const context_signature = hashValidationContext({
    submission_id: snapshot.submission_id,
    version: VALIDATION_MODEL_VERSION,
    status: snapshot.submission_status,
    evidence_type: snapshot.evidence_type,
    assets: snapshot.assets.map((a) => ({
      id: a.id,
      checksum: a.checksum_sha256,
      size: a.size_bytes,
    })),
    observation: snapshot.observation,
    links: snapshot.requirement_links,
    captured_at: snapshot.captured_at,
    location: snapshot.location_geometry,
  })

  if (snapshot.submission_status === 'withdrawn' || snapshot.intake_status === 'withdrawn') {
    return rejected(snapshot, 'withdrawn_by_submitter', checks, context_signature, limitations)
  }
  if (snapshot.is_superseded) {
    return buildResult({
      snapshot,
      status: 'superseded',
      rejection: null,
      reason: 'Evidencia superseded por versión posterior',
      rules: ['superseded_submission'],
      limitations,
      followUp: [],
      strength: 'very_low',
      scores: zeroScores(),
      checks,
      requirementLinks: mapLinks(snapshot, 'superseded'),
      conflicts: [],
      context_signature,
      warnings,
    })
  }
  if (snapshot.is_exact_duplicate || snapshot.intake_status === 'duplicate') {
    return rejected(snapshot, 'exact_duplicate', checks, context_signature, limitations)
  }

  // Technical integrity
  let techScore = 100
  if (snapshot.assets.length === 0 && !snapshot.observation) {
    checks.push({
      dimension: 'technical_integrity',
      check_code: 'content_present',
      outcome: 'failed',
      message: 'Sin archivo ni observación',
      weight: 1,
    })
    techScore = 0
  }
  for (const asset of snapshot.assets) {
    if (!asset.upload_confirmed) {
      checks.push({
        dimension: 'technical_integrity',
        check_code: 'upload_confirmed',
        outcome: 'failed',
        message: 'Asset no confirmado',
        weight: 1,
      })
      techScore -= 40
    }
    if (!asset.checksum_sha256 || asset.size_bytes <= 0) {
      checks.push({
        dimension: 'technical_integrity',
        check_code: 'asset_integrity',
        outcome: 'failed',
        message: 'Integridad de archivo insuficiente',
        weight: 1,
      })
      techScore -= 50
      return rejected(snapshot, 'corrupted_asset', checks, context_signature, limitations)
    }
    if (asset.mime_extension_mismatch) {
      checks.push({
        dimension: 'technical_integrity',
        check_code: 'mime_extension',
        outcome: 'warning',
        message: 'Extensión y MIME no coinciden',
        weight: 0.5,
      })
      techScore -= 10
      limitations.push('Extensión y MIME no coinciden')
    }
  }
  if (snapshot.submission_status !== 'ready_for_validation') {
    checks.push({
      dimension: 'technical_integrity',
      check_code: 'intake_ready',
      outcome: 'failed',
      message: `Estado intake: ${snapshot.submission_status}`,
      weight: 1,
    })
    techScore -= 30
  } else {
    checks.push({
      dimension: 'technical_integrity',
      check_code: 'intake_ready',
      outcome: 'passed',
      message: 'Intake completado',
      weight: 1,
    })
  }
  techScore = clamp(techScore)

  // Provenance
  let provScore = 60
  if (snapshot.submitted_by_id) {
    provScore += 20
    checks.push({
      dimension: 'provenance',
      check_code: 'submitter_identified',
      outcome: 'passed',
      message: 'Submitter identificado',
      weight: 1,
    })
  } else {
    checks.push({
      dimension: 'provenance',
      check_code: 'submitter_identified',
      outcome: 'failed',
      message: 'Submitter no identificado',
      weight: 1,
    })
    provScore -= 30
  }
  if (snapshot.source_type) provScore += 10
  if (snapshot.source_device) provScore += 10
  provScore = clamp(provScore)

  // Temporal relevance
  let tempScore = 50
  const captured = snapshot.captured_at
  const missionStart = Date.parse(snapshot.mission.earliest_start_at)
  const missionEnd = Date.parse(snapshot.mission.expires_at)
  if (captured) {
    const capMs = Date.parse(captured)
    if (capMs >= missionStart && capMs <= missionEnd) {
      tempScore = 90
      checks.push({
        dimension: 'temporal_relevance',
        check_code: 'within_mission_window',
        outcome: 'passed',
        message: 'Captura dentro de ventana de misión',
        weight: 1,
      })
    } else {
      tempScore = 25
      checks.push({
        dimension: 'temporal_relevance',
        check_code: 'within_mission_window',
        outcome: 'warning',
        message: 'Captura fuera de ventana de misión',
        weight: 1,
      })
      limitations.push('Timestamp fuera de ventana de misión')
    }
    const delayH = hoursBetween(captured, snapshot.submitted_at)
    if (delayH != null && delayH > 48) {
      limitations.push(`Retraso captura-envío: ${Math.round(delayH)} h`)
      tempScore -= 15
    }
  } else {
    checks.push({
      dimension: 'temporal_relevance',
      check_code: 'captured_at_present',
      outcome: 'warning',
      message: 'Sin captured_at',
      weight: 1,
    })
    limitations.push('Metadata temporal incompleta')
    tempScore = 40
  }
  tempScore = clamp(tempScore)

  // Spatial relevance
  let spatialScore = 50
  const centroid = missionCentroid(snapshot.mission.location_geometry)
  const loc = snapshot.location_geometry ?? snapshot.device_location_geometry
  if (loc && centroid) {
    const dist = pointDistanceM(loc.coordinates, centroid)
    if (dist < 500) spatialScore = 95
    else if (dist < 2000) spatialScore = 75
    else if (dist < 10000) spatialScore = 50
    else spatialScore = 30
    checks.push({
      dimension: 'spatial_relevance',
      check_code: 'distance_to_mission',
      outcome: dist > 10000 ? 'warning' : 'passed',
      message: `Distancia al área: ${Math.round(dist)} m`,
      weight: 1,
    })
    if (snapshot.location_outside_mission_area) {
      limitations.push('Ubicación marcada fuera del área de misión')
      spatialScore = Math.min(spatialScore, 45)
      decision_rules.push('outside_area_limitation_not_auto_reject')
    }
  } else if (snapshot.evidence_type !== 'structured_observation') {
    limitations.push('Sin geolocalización')
    spatialScore = 35
    checks.push({
      dimension: 'spatial_relevance',
      check_code: 'location_present',
      outcome: 'warning',
      message: 'Sin ubicación',
      weight: 1,
    })
  } else {
    spatialScore = 60
    checks.push({
      dimension: 'spatial_relevance',
      check_code: 'observation_scope',
      outcome: 'passed',
      message: 'Alcance espacial de observación registrado',
      weight: 1,
    })
  }
  if (snapshot.location_accuracy_m && snapshot.location_accuracy_m > 100) {
    limitations.push(`Precisión GPS baja: ${snapshot.location_accuracy_m} m`)
    spatialScore -= 15
  }
  spatialScore = clamp(spatialScore)

  // Semantic relevance
  let semanticScore = 0
  const matchedLinks = snapshot.requirement_links.filter((l) => l.match_type === 'matched')
  const partialLinks = snapshot.requirement_links.filter((l) => l.match_type === 'partial_match')
  if (matchedLinks.length > 0) {
    semanticScore = 85
    checks.push({
      dimension: 'semantic_relevance',
      check_code: 'requirement_match',
      outcome: 'passed',
      message: 'Tipo compatible con requirement',
      weight: 1,
    })
  } else if (partialLinks.length > 0) {
    semanticScore = 55
    limitations.push('Cobertura semántica parcial del requirement')
    checks.push({
      dimension: 'semantic_relevance',
      check_code: 'requirement_match',
      outcome: 'warning',
      message: 'Match parcial con requirement',
      weight: 1,
    })
  } else if (snapshot.requirement_links.every((l) => l.match_type === 'not_matched')) {
    semanticScore = 10
    checks.push({
      dimension: 'semantic_relevance',
      check_code: 'requirement_match',
      outcome: 'failed',
      message: 'Irrelevante a requirements vinculados',
      weight: 1,
    })
    return rejected(snapshot, 'irrelevant_to_requirement', checks, context_signature, limitations)
  } else {
    semanticScore = 40
    checks.push({
      dimension: 'semantic_relevance',
      check_code: 'requirement_match',
      outcome: 'warning',
      message: 'Sin match claro',
      weight: 1,
    })
  }
  semanticScore = clamp(semanticScore)

  // Completeness
  let completeScore = 70
  if (!captured && snapshot.evidence_type !== 'structured_observation') {
    completeScore -= 25
    limitations.push('Falta captured_at')
  }
  if (!loc && ['georeferenced_photo', 'drone_image', 'location_confirmation'].includes(snapshot.evidence_type)) {
    completeScore -= 25
    limitations.push('Falta ubicación para tipo georreferenciado')
  }
  if (snapshot.evidence_type === 'structured_observation' && !snapshot.observation) {
    completeScore = 15
    return rejected(snapshot, 'missing_mandatory_content', checks, context_signature, limitations)
  }
  if (snapshot.assets.length === 0 && !snapshot.observation) completeScore = 0
  completeScore = clamp(completeScore)

  // Source independence
  let indepScore = 80
  const sameSubmitter = snapshot.peer_submissions.filter(
    (p) =>
      p.submitted_by_id === snapshot.submitted_by_id &&
      p.submission_id !== snapshot.submission_id &&
      p.validation_status &&
      ['accepted', 'accepted_with_limitations'].includes(p.validation_status),
  )
  if (sameSubmitter.length > 0) {
    indepScore -= 25 * Math.min(sameSubmitter.length, 3)
    limitations.push('Evidencia correlacionada con misma fuente')
    checks.push({
      dimension: 'source_independence',
      check_code: 'same_submitter',
      outcome: 'warning',
      message: 'Misma fuente con evidencia previa aceptada',
      weight: 1,
    })
  }
  const distinctSources = new Set(
    snapshot.peer_submissions
      .filter((p) => p.submission_id !== snapshot.submission_id)
      .map((p) => p.submitted_by_id),
  )
  if (distinctSources.size >= 2) {
    indepScore += 10
    checks.push({
      dimension: 'source_independence',
      check_code: 'multiple_sources',
      outcome: 'passed',
      message: 'Otras fuentes presentes en la misión',
      weight: 1,
    })
  }
  indepScore = clamp(indepScore)

  // Usability
  let usabilityScore = 60
  const asset = snapshot.assets[0]
  if (asset?.width && asset?.height) {
    if (asset.width >= 1280 && asset.height >= 720) usabilityScore = 85
    else if (asset.width >= 640) usabilityScore = 65
    else {
      usabilityScore = 40
      limitations.push('Resolución baja')
    }
    checks.push({
      dimension: 'usability',
      check_code: 'resolution',
      outcome: usabilityScore >= 65 ? 'passed' : 'warning',
      message: `${asset.width}x${asset.height}`,
      weight: 1,
    })
  }
  if (snapshot.observation) {
    const dist = snapshot.observation.observation_distance_m
    const vis = snapshot.observation.visibility_conditions
    if (typeof dist === 'number' && dist > 500) limitations.push('Distancia de observación elevada')
    if (typeof vis === 'string' && /nublad|lluvia|niebla/i.test(vis)) {
      limitations.push('Condiciones de visibilidad limitadas')
      usabilityScore -= 15
    }
    usabilityScore = Math.max(usabilityScore, 55)
  }
  usabilityScore = clamp(usabilityScore)

  const scores = {
    technical_integrity_score: techScore,
    provenance_score: provScore,
    temporal_relevance_score: tempScore,
    spatial_relevance_score: spatialScore,
    semantic_relevance_score: semanticScore,
    completeness_score: completeScore,
    source_independence_score: indepScore,
    usability_score: usabilityScore,
    overall_quality_score: clamp(
      techScore * SCORE_WEIGHTS.technical_integrity +
        provScore * SCORE_WEIGHTS.provenance +
        tempScore * SCORE_WEIGHTS.temporal_relevance +
        spatialScore * SCORE_WEIGHTS.spatial_relevance +
        semanticScore * SCORE_WEIGHTS.semantic_relevance +
        completeScore * SCORE_WEIGHTS.completeness +
        indepScore * SCORE_WEIGHTS.source_independence +
        usabilityScore * SCORE_WEIGHTS.usability,
    ),
  }

  const strength = strengthFromScore(scores.overall_quality_score, scores.semantic_relevance_score)
  const conflict_flags = detectConflicts(snapshot)

  // Negative observations - valid but scoped
  if (snapshot.observation) {
    const notes = String(snapshot.observation.observer_notes ?? '')
    if (notes) {
      try {
        assertSafeValidationCopy(notes)
      } catch {
        return rejected(snapshot, 'invalid_format', checks, context_signature, limitations)
      }
    }
    const negFields = ['visible_smoke', 'visible_flame', 'burned_vegetation_indicators'] as const
    const allNo = negFields.every((f) => snapshot.observation![f] === 'no')
    if (allNo) {
      limitations.push('Observación negativa con alcance local y temporal limitado')
      recommended_follow_up.push('Requiere evidencia adicional para ampliar cobertura')
      decision_rules.push('negative_observation_not_incident_resolution')
      warnings.push('Observación negativa no resuelve el incidente')
    }
  }

  let status: ValidationStatus = 'inconclusive'
  let decision_reason = 'Evidencia inconclusa; requiere evidencia adicional'

  if (techScore < 30) {
    return rejected(snapshot, 'integrity_failure', checks, context_signature, limitations)
  }

  if (scores.overall_quality_score >= ACCEPTED_MIN_OVERALL && limitations.length === 0) {
    status = 'accepted'
    decision_reason = 'Evidencia aceptada con calidad y relevancia suficientes'
    decision_rules.push('accepted_threshold_met')
  } else if (
    scores.overall_quality_score >= ACCEPTED_WITH_LIMITATIONS_MIN &&
    semanticScore >= 40
  ) {
    status = 'accepted_with_limitations'
    decision_reason = 'Evidencia aceptada con limitaciones documentadas'
    decision_rules.push('accepted_with_limitations_threshold_met')
  } else if (scores.overall_quality_score < ACCEPTED_WITH_LIMITATIONS_MIN && semanticScore < 30) {
    status = 'rejected'
    decision_reason = 'Evidencia rechazada por baja relevancia y calidad'
    return buildResult({
      snapshot,
      status,
      rejection: 'irrelevant_to_requirement',
      reason: decision_reason,
      rules: decision_rules,
      limitations,
      followUp: recommended_follow_up,
      strength: 'very_low',
      scores,
      checks,
      requirementLinks: mapLinks(snapshot, status),
      conflicts: conflict_flags,
      context_signature,
      warnings,
    })
  } else {
    status = 'inconclusive'
    recommended_follow_up.push('Requiere evidencia adicional')
    decision_rules.push('inconclusive_insufficient_basis')
  }

  if (tempScore < 25 && status === 'accepted') {
    status = 'inconclusive'
    decision_reason = 'Ventana temporal insuficiente para aceptación plena'
    limitations.push('Timestamp fuera de ventana permitida')
  }

  return buildResult({
    snapshot,
    status,
    rejection: null,
    reason: decision_reason,
    rules: decision_rules,
    limitations,
    followUp: recommended_follow_up,
    strength,
    scores,
    checks,
    requirementLinks: mapLinks(snapshot, status),
    conflicts: conflict_flags,
    context_signature,
    warnings,
  })
}

function mapLinks(snapshot: ValidationSnapshot, status: ValidationStatus): RequirementLinkValidation[] {
  return snapshot.requirement_links.map((l) => ({
    requirement_id: l.requirement_id,
    evidence_type: l.evidence_type,
    match_type: l.match_type,
    valid_coverage_status: coverageFromDecision(status, l.match_type),
    reason: `Decisión ${status} sobre match ${l.match_type}`,
  }))
}

function zeroScores() {
  return {
    technical_integrity_score: 0,
    provenance_score: 0,
    temporal_relevance_score: 0,
    spatial_relevance_score: 0,
    semantic_relevance_score: 0,
    completeness_score: 0,
    source_independence_score: 0,
    usability_score: 0,
    overall_quality_score: 0,
  }
}

function rejected(
  snapshot: ValidationSnapshot,
  code: RejectionReasonCode,
  checks: ValidationCheckResult[],
  context_signature: string,
  limitations: string[],
): ValidationDecisionResult {
  return buildResult({
    snapshot,
    status: 'rejected',
    rejection: code,
    reason: `Evidencia rechazada: ${code}`,
    rules: [`rejected_${code}`],
    limitations,
    followUp: [],
    strength: 'very_low',
    scores: zeroScores(),
    checks,
    requirementLinks: mapLinks(snapshot, 'rejected'),
    conflicts: [],
    context_signature,
    warnings: [],
  })
}

function buildResult(input: {
  snapshot: ValidationSnapshot
  status: ValidationStatus
  rejection: RejectionReasonCode | null
  reason: string
  rules: string[]
  limitations: string[]
  followUp: string[]
  strength: EvidenceStrength
  scores: ValidationDecisionResult['scores']
  checks: ValidationCheckResult[]
  requirementLinks: RequirementLinkValidation[]
  conflicts: ConflictFlagResult[]
  context_signature: string
  warnings: string[]
}): ValidationDecisionResult {
  return {
    ok: true,
    status: input.status,
    rejection_reason_code: input.rejection,
    decision_reason: input.reason,
    decision_rules: input.rules,
    limitations: input.limitations,
    recommended_follow_up: input.followUp,
    evidence_strength: input.strength,
    scores: input.scores,
    score_explanation: {
      technical_integrity: 'Integridad técnica del archivo y procesamiento',
      provenance: 'Identificación de fuente y cadena de creación',
      temporal_relevance: 'Relevancia respecto a ventana de misión',
      spatial_relevance: 'Proximidad y precisión espacial',
      semantic_relevance: 'Compatibilidad con requirement y need',
      completeness: 'Metadatos y contenido obligatorio',
      source_independence: 'Independencia respecto a otras fuentes',
      usability: 'Claridad y usabilidad operacional',
    },
    checks: input.checks,
    requirement_links: input.requirementLinks,
    conflict_flags: input.conflicts,
    context_signature: input.context_signature,
    warnings: input.warnings,
  }
}

export { VALIDATION_MODEL_VERSION }
