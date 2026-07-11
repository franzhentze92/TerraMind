import { Link } from 'react-router-dom'
import { useNationalSituation } from '../../NationalSituationContext'
import { useSituationRouteAccess } from '../../hooks/useSituationRouteAccess'
import {
  needResolutionStatusLabel,
  verificationPlanStatusLabel,
} from '@/modules/verification/utils/verification-labels'
import { evidenceSubmissionStatusLabel } from '../../utils/situation-labels'

export function VerificacionTab() {
  const { dashboardQuery, metricsQuery } = useNationalSituation()
  const canView = useSituationRouteAccess('/verificaciones')
  const dashboard = dashboardQuery.data
  const verifLegacy = metricsQuery.data?.metrics.find((m) => m.id === 'verification_plans_legacy')?.value ?? 0
  const verifNeeds = metricsQuery.data?.metrics.find((m) => m.id === 'verification_needs_active')?.value ?? 0

  return (
    <div className="space-y-4" data-testid="tab-verificacion">
      <MetricRow label="Necesidades de verificación activas" value={verifNeeds} href="/verificaciones" show={canView} />
      <MetricRow label="Planes históricos" value={verifLegacy} href="/verificaciones" show={canView} />
      <ListSection
        title="Verificaciones pendientes"
        items={(dashboard?.pending_verifications ?? []).map((v) => ({
          id: v.id,
          label: `${verificationPlanStatusLabel(v.status)} · incidente ${v.incident_id.slice(0, 8)}…`,
          href: v.href,
        }))}
        show={canView}
      />
      <ListSection
        title="Evidencia reciente"
        items={(dashboard?.recent_evidence ?? []).map((e) => ({
          id: e.id,
          label: `${evidenceSubmissionStatusLabel(e.status)} · misión ${e.mission_id.slice(0, 8)}…`,
          href: e.href,
        }))}
        show={canView}
      />
      <ListSection
        title="Resoluciones recientes"
        items={(dashboard?.recent_resolutions ?? []).map((r) => ({
          id: r.id,
          label: needResolutionStatusLabel(r.status),
          href: r.href,
        }))}
        show={canView}
      />
    </div>
  )
}

function MetricRow({
  label,
  value,
  href,
  show,
}: {
  label: string
  value: number
  href: string
  show: boolean
}) {
  if (!show) return null
  return (
    <div className="flex justify-between rounded-lg border border-border-subtle px-4 py-3 text-sm">
      <span className="text-text-secondary">{label}</span>
      <Link to={href} className="font-medium text-accent">
        {value}
      </Link>
    </div>
  )
}

function ListSection({
  title,
  items,
  show,
}: {
  title: string
  items: Array<{ id: string; label: string; href: string }>
  show: boolean
}) {
  if (!show) return null
  return (
    <section className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">Sin registros en vista.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={item.href} className="text-sm hover:text-accent">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
