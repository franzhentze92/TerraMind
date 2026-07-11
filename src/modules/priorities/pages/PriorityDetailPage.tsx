import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/shared/components/PageHeader'
import { Badge } from '@/shared/components/Badge'
import { usePriorityDetail } from '../hooks/usePriorities'
import {
  actionLevelLabel,
  attentionLevelLabel,
  domainLabel,
  verificationLevelLabel,
} from '../utils/priority-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { IntelligenceFlowSections } from '@/modules/intelligence-flow/components/IntelligenceFlowSections'
import { PriorityScoreExplanation } from '@/modules/intelligence-flow/components/PriorityScoreExplanation'

export function PriorityDetailPage() {
  const { priorityId } = useParams<{ priorityId: string }>()
  const query = usePriorityDetail(priorityId)

  if (query.isLoading) {
    return <p className="p-6 text-sm text-text-tertiary">Cargando evaluación…</p>
  }
  if (query.isError || !query.data) {
    return <p className="p-6 text-sm text-confidence-low">Evaluación no disponible.</p>
  }

  const p = query.data
  const location = p.department_name ?? 'Sin departamento'

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="priority-detail-page">
      <PageHeader
        title={`Prioridad · ${location}`}
        subtitle={`Evaluado ${formatGuatemalaDateTime(p.evaluated_at)}`}
        breadcrumbs={[
          { label: 'Situación Nacional', to: '/situacion' },
          { label: 'Prioridades', to: '/prioridades' },
          { label: location },
        ]}
      />

      <IntelligenceFlowSections resourceType="priority" resourceId={priorityId} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="warning">{attentionLevelLabel(p.attention_level)}</Badge>
        <Badge variant="default">{verificationLevelLabel(p.verification_level)}</Badge>
        <Badge variant="default">{actionLevelLabel(p.action_level)}</Badge>
      </div>

      <PriorityScoreExplanation
        attentionScore={p.attention_score}
        verificationScore={p.verification_score}
        actionScore={p.action_score}
        attentionLevel={p.attention_level}
        verificationLevel={p.verification_level}
        actionLevel={p.action_level}
        reasons={p.priority_reasons}
        recommendedNextStep={p.recommended_next_step}
        limitations={p.priority_limitations}
      />

      <section className="mb-6 mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Hallazgos que contribuyeron</h2>
        <div className="space-y-2">
          {p.finding_snapshot.map((f) => (
            <div
              key={f.finding_id}
              className="rounded border border-border-subtle px-3 py-2 text-sm"
            >
              <div className="flex justify-between gap-2">
                <Link to={`/hallazgos/${f.finding_id}`} className="font-medium text-accent hover:underline">
                  {f.title}
                </Link>
                <span className="text-xs text-text-tertiary">
                  {f.contributed ? `+${f.accepted_contribution}` : 'No aportó'}
                </span>
              </div>
              {f.discard_reason && (
                <p className="mt-1 text-xs text-text-tertiary">{f.discard_reason}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Desglose de componentes</h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>Severidad: {p.severity_component}</p>
          <p>Urgencia: {p.urgency_component}</p>
          <p>Exposición: {p.exposure_component}</p>
          <p>Sensibilidad: {p.sensitivity_component}</p>
          <p>Persistencia: {p.persistence_component}</p>
          <p>Incertidumbre: {p.confidence_component}</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {Object.entries(p.domain_contributions).map(([domain, value]) => (
            <span key={domain} className="rounded border border-border-subtle px-2 py-1">
              {domainLabel(domain)}: {value}
            </span>
          ))}
        </div>
      </section>

      {p.change_reasons.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-sm font-semibold text-text-primary">Cambio desde evaluación anterior</h2>
          <ul className="list-inside list-disc text-sm text-text-secondary">
            {p.change_reasons.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {p.entity_type === 'fire_event' && (
        <Link to={`/incendios/${p.entity_id}`} className="text-sm text-accent hover:underline">
          Ver evento térmico relacionado →
        </Link>
      )}

      <details className="mt-4 text-xs text-text-tertiary">
        <summary className="cursor-pointer">Detalle técnico del modelo</summary>
        <p className="mt-2">Modelo {p.priority_model_version} · Contexto {p.context_version}</p>
      </details>
    </div>
  )
}
