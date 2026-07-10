import { Link } from 'react-router-dom'
import { Badge } from '@/shared/components/Badge'
import type { IncidentSummaryDto } from '../api/incidents-api'
import {
  incidentStatusLabel,
  incidentStatusVariant,
  incidentTypeLabel,
} from '../utils/incident-labels'
import {
  attentionLevelLabel,
  verificationLevelLabel,
} from '@/modules/priorities/utils/priority-labels'

interface FireEventIncidentSectionProps {
  data?: {
    incident: IncidentSummaryDto | null
    recent_evaluations: Array<{
      correlation_decision?: string
      correlation_reasons?: string[]
      rejected_reasons?: string[]
    }>
  } | null
  isLoading?: boolean
}

export function FireEventIncidentSection({ data, isLoading }: FireEventIncidentSectionProps) {
  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-surface-3" />
  }

  if (!data?.incident) {
    return (
      <p className="text-sm text-text-tertiary">
        Este evento no está asociado a una situación operacional todavía.
      </p>
    )
  }

  const incident = data.incident
  const latest = data.recent_evaluations[0]

  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-2/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={incidentStatusVariant(incident.status)}>
          {incidentStatusLabel(incident.status)}
        </Badge>
        <span className="text-xs text-text-tertiary">
          {incidentTypeLabel(incident.incident_type)}
        </span>
      </div>
      <p className="text-xs text-text-secondary">
        Atención {attentionLevelLabel(incident.attention_level)} · Verificación{' '}
        {verificationLevelLabel(incident.verification_level)} · {incident.event_count} evento(s)
      </p>
      {latest?.correlation_reasons?.[0] && (
        <p className="text-xs text-text-tertiary">{latest.correlation_reasons[0]}</p>
      )}
      <Link to={`/incidentes/${incident.id}`} className="text-xs font-medium text-accent hover:underline">
        Ver situación operacional
      </Link>
    </div>
  )
}
