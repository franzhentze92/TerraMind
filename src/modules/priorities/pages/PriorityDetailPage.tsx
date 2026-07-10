import { Link, useParams } from 'react-router-dom'
import { Badge } from '@/shared/components/Badge'
import { usePriorityDetail } from '../hooks/usePriorities'
import {
  actionLevelLabel,
  attentionLevelLabel,
  domainLabel,
  verificationLevelLabel,
} from '../utils/priority-labels'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

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

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-4">
        <Link to="/prioridades" className="text-xs text-accent hover:underline">
          ← Cola de prioridades
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-text-primary">
          Evaluación de prioridad · {p.department_name ?? 'Sin departamento'}
        </h1>
        <p className="mt-1 text-xs text-text-tertiary">
          Evaluado {formatGuatemalaDateTime(p.evaluated_at)} · Modelo {p.priority_model_version}
        </p>
      </div>

      <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4">
        <h2 className="text-sm font-semibold text-text-primary">Resumen operativo</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="warning">{attentionLevelLabel(p.attention_level)}</Badge>
          <Badge variant="default">{verificationLevelLabel(p.verification_level)}</Badge>
          <Badge variant="default">{actionLevelLabel(p.action_level)}</Badge>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] uppercase text-text-tertiary">Atención</p>
            <p className="text-xl font-semibold">{p.attention_score}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-text-tertiary">Verificación</p>
            <p className="text-xl font-semibold">{p.verification_score}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-text-tertiary">Acción</p>
            <p className="text-xl font-semibold">{p.action_score}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-text-secondary">{p.recommended_next_step}</p>
      </section>

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Factores principales</h2>
        <ul className="list-inside list-disc text-sm text-text-secondary">
          {p.priority_reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
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

      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-semibold text-text-primary">Hallazgos que contribuyeron</h2>
        <div className="space-y-2">
          {p.finding_snapshot.map((f) => (
            <div
              key={f.finding_id}
              className="rounded border border-border-subtle px-3 py-2 text-sm"
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{f.title}</span>
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
        <h2 className="text-sm font-semibold text-text-primary">Limitaciones</h2>
        <ul className="list-inside list-disc text-sm text-text-secondary">
          {p.priority_limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
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
        <Link
          to={`/incendios/${p.entity_id}`}
          className="text-sm text-accent hover:underline"
        >
          Ver evento térmico relacionado
        </Link>
      )}
    </div>
  )
}
