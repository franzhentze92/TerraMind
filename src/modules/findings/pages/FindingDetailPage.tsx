import { Link, useParams } from 'react-router-dom'
import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useFindingDetail } from '../hooks/useFindings'
import {
  findingConfidenceLabel,
  findingDomainLabel,
  findingSeverityLabel,
  findingStatusLabel,
} from '../utils/finding-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

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

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <ModuleHeader title={finding.title} description={finding.summary} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="default">{findingSeverityLabel(finding.severity_label)}</Badge>
        <Badge variant="default">{findingConfidenceLabel(finding.confidence.level)}</Badge>
        <Badge variant="default">{findingStatusLabel(finding.status)}</Badge>
      </div>

      <section className="space-y-4">
        <div className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Por qué se generó
          </h2>
          <ul className="mt-2 list-disc pl-4 text-sm text-text-secondary">
            {finding.triggered_rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Evidencia
          </h2>
          <div className="mt-2 space-y-2">
            {finding.evidence.map((ev) => (
              <div key={ev.evidence_code} className="text-sm border-b border-border-subtle/50 pb-2">
                <p className="font-medium text-text-primary">{ev.label}</p>
                <p className="text-text-secondary">
                  {String(ev.value)}
                  {ev.unit ? ` ${ev.unit}` : ''}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  {findingDomainLabel(ev.domain)} · {ev.source} · {ev.quality}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Limitaciones
          </h2>
          <ul className="mt-2 list-disc pl-4 text-sm text-text-secondary">
            {finding.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
            Acciones sugeridas
          </h2>
          <ul className="mt-2 list-disc pl-4 text-sm text-text-secondary">
            {finding.recommended_actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>

        {finding.entity_type === 'fire_event' && (
          <Link
            to={`/incendios/${finding.entity_id}`}
            className="text-sm text-accent hover:underline"
          >
            Ver evento térmico relacionado
          </Link>
        )}

        <p className="text-[11px] text-text-tertiary">
          Generado: {formatGuatemalaDateTime(finding.generated_at)} · Rule set{' '}
          {finding.rule_set_version}
        </p>
      </section>
    </div>
  )
}
