import { assertSafeFindingCopy } from '../findings-copy-guard'
import type {
  CompositeFinding,
  FindingEvaluationResult,
  FindingRuleResult,
} from '../findings.types'
import { evaluateAllFireFindingRules } from '../rules/fire-finding-rules'
import type { FireFindingEvaluationContext } from '../services/fire-finding-context.loader'
import { loadFireFindingEvaluationContext } from '../services/fire-finding-context.loader'

export class CompositeFindingEngine {
  evaluateRules(
    ctx: FireFindingEvaluationContext,
  ): FindingRuleResult[] {
    return evaluateAllFireFindingRules(ctx)
  }

  buildFinding(
    ctx: FireFindingEvaluationContext,
    ruleResult: FindingRuleResult,
  ): CompositeFinding | null {
    if (ruleResult.status !== 'triggered') return null

    assertSafeFindingCopy(ruleResult.title)
    assertSafeFindingCopy(ruleResult.summary)

    const generatedAt = new Date().toISOString()

    return {
      finding_type: ruleResult.finding_type,
      entity_type: 'fire_event',
      entity_id: ctx.event.id,
      title: ruleResult.title,
      summary: ruleResult.summary,
      status: 'active',
      severity_label: ruleResult.severity_label,
      confidence: ruleResult.confidence,
      evidence: ruleResult.evidence,
      triggered_rules: [ruleResult.rule_code],
      source_domains: ruleResult.source_domains,
      geographic_context: {
        department_code: ctx.event.department_code,
        department_name: ctx.event.department_name,
        centroid_lat: ctx.event.centroid_lat,
        centroid_lng: ctx.event.centroid_lng,
      },
      temporal_context: {
        first_detected_at: ctx.event.first_detected_at,
        last_detected_at: ctx.event.last_detected_at,
        evaluated_at: generatedAt,
      },
      limitations: ruleResult.limitations,
      recommended_actions: ruleResult.recommended_actions,
      generated_at: generatedAt,
      context_version: ctx.context_versions.composite,
      rule_set_version: ctx.context_versions.rule_set,
    }
  }

  evaluateFireEventContext(
    ctx: FireFindingEvaluationContext,
  ): {
    entity_type: string
    entity_id: string
    context_version: string
    rule_set_version: string
    contexts_available: Record<string, string>
    rule_results: FindingRuleResult[]
    findings: CompositeFinding[]
    warnings: string[]
    duration_ms: number
  } {
    const started = Date.now()
    const ruleResults = this.evaluateRules(ctx)
    const findings = ruleResults
      .map((r) => this.buildFinding(ctx, r))
      .filter((f): f is CompositeFinding => f !== null)

    const warnings: string[] = []
    if (ctx.availability.protected_area === 'missing') {
      warnings.push('protected_area_context_missing')
    }
    if (ctx.availability.land_cover === 'missing') {
      warnings.push('land_cover_context_missing')
    }

    return {
      entity_type: 'fire_event',
      entity_id: ctx.event.id,
      context_version: ctx.context_versions.composite,
      rule_set_version: ctx.context_versions.rule_set,
      contexts_available: {
        protected_area: ctx.availability.protected_area,
        land_cover: ctx.availability.land_cover,
        population: ctx.availability.population,
        climate: ctx.availability.climate,
        biodiversity: ctx.availability.biodiversity,
      },
      rule_results: ruleResults,
      findings,
      warnings,
      duration_ms: Date.now() - started,
    }
  }

  async evaluateFireEvent(eventId: string): Promise<FindingEvaluationResult | null> {
    const started = Date.now()
    const ctx = await loadFireFindingEvaluationContext(eventId)
    if (!ctx) return null

    const partial = this.evaluateFireEventContext(ctx)
    return {
      ...partial,
      findings_created: 0,
      findings_updated: 0,
      findings_resolved: 0,
      duration_ms: Date.now() - started,
    }
  }

  async evaluateEntity(input: {
    entityType: string
    entityId: string
    profile: 'fire_event'
  }): Promise<FindingEvaluationResult | null> {
    if (input.profile !== 'fire_event' || input.entityType !== 'fire_event') {
      throw new Error('Perfil no soportado en 8A.1')
    }
    return this.evaluateFireEvent(input.entityId)
  }
}

export const compositeFindingEngine = new CompositeFindingEngine()
