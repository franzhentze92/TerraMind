import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '@/shared/components/PageHeader'
import { Badge } from '@/shared/components/Badge'
import { useFindingDetail } from '../hooks/useFindings'
import {
  findingConfidenceLabel,
  findingDomainLabel,
  findingSeverityLabel,
  findingStatusLabel,
} from '../utils/finding-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { IntelligenceFlowSections } from '@/modules/intelligence-flow/components/IntelligenceFlowSections'

export function FindingDetailPage() {
  const { findingId } = useParams<{ findingId: string }>()
  const query = useFindingDetail(findingId)

  if (query.isLoading) {
    return <p className="p-6 text-sm text-text-tertiary">Cargando hallazgo…</p>
  }

  if (query.isError || !query.data) {
    return <p className="p-6 text-sm text-confidence-low">Hallazgo no encontrado.</p>
  }

  const finding = query.data
  const breadcrumbTitle =
    finding.title.length > 48 ? `${finding.title.slice(0, 45)}…` : finding.title

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="finding-detail-page">
      <PageHeader
        title={finding.title}
        subtitle={finding.summary}
        breadcrumbs={[
          { label: 'Situación Nacional', to: '/situacion' },
          { label: 'Hallazgos', to: '/hallazgos' },
          { label: breadcrumbTitle },
        ]}
        updatedAt={formatGuatemalaDateTime(finding.generated_at)}
      />

      <IntelligenceFlowSections resourceType="finding" resourceId={findingId} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="default">{findingSeverityLabel(finding.severity_label)}</Badge>
        <Badge variant="default">{findingConfidenceLabel(finding.confidence.level)}</Badge>
        <Badge variant="default">{findingStatusLabel(finding.status)}</Badge>
        {finding.department_name && <Badge variant="default">{finding.department_name}</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Qué se observó
          </h2>
          <p className="mt-2 text-sm text-text-secondary">{finding.summary}</p>
        </section>

        <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Qué interpreta TerraMind
          </h2>
          <ul className="mt-2 list-disc pl-4 text-sm text-text-secondary">
            {finding.triggered_rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-4 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          Fuentes y evidencia de contexto
        </h2>
        <div className="mt-2 space-y-2">
          {finding.evidence.map((ev) => (
            <div key={ev.evidence_code} className="border-b border-border-subtle/50 pb-2 text-sm">
              <p className="font-medium text-text-primary">{ev.label}</p>
              <p className="text-text-secondary">
                {String(ev.value)}
                {ev.unit ? ` ${ev.unit}` : ''}
              </p>
              <p className="text-[11px] text-text-tertiary">
                {findingDomainLabel(ev.domain)} · {ev.source}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
          Confianza y limitaciones
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          Confianza: {findingConfidenceLabel(finding.confidence.level)} ({finding.confidence.score})
        </p>
        <ul className="mt-2 list-disc pl-4 text-sm text-text-secondary">
          {finding.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      {finding.recommended_actions.length > 0 && (
        <section className="mt-4 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Siguiente paso
          </h2>
          <ul className="mt-2 list-disc pl-4 text-sm text-text-secondary">
            {finding.recommended_actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {finding.entity_type === 'fire_event' && (
        <Link
          to={`/incendios/${finding.entity_id}`}
          className="mt-4 inline-block text-sm text-accent hover:underline"
        >
          Ver fuente térmica →
        </Link>
      )}

      <details className="mt-4 text-xs text-text-tertiary">
        <summary className="cursor-pointer">Ver metodología técnica</summary>
        <p className="mt-2">Rule set {finding.rule_set_version}</p>
      </details>
    </div>
  )
}
