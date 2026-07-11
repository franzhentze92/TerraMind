import { Link } from 'react-router-dom'
import { useIncidentMissions } from '../hooks/useMissions'
import { missionStatusLabel, missionTypeLabel } from '../utils/mission-labels'
import { missionPriorityLabel, missionShortRef } from '../utils/mission-presentation'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

interface Props {
  incidentId: string
}

export function IncidentMissionsSection({ incidentId }: Props) {
  const query = useIncidentMissions(incidentId)
  const items = query.data?.items ?? []

  if (query.isLoading) return null
  if (items.length === 0) return null

  return (
    <section className="rounded-lg border border-border-subtle bg-surface-2/30 p-4">
      <h2 className="mb-2 text-sm font-semibold text-text-primary">Misiones relacionadas</h2>
      <div className="space-y-2">
        {items.map((m) => {
          const isDemo = m.classification === 'demo'
          return (
            <Link
              key={m.id}
              to={`/misiones/${m.id}`}
              className="block rounded border border-border-subtle/60 px-3 py-2 text-xs hover:border-accent/40"
            >
              <p className="font-medium text-text-primary">
                {missionTypeLabel(m.mission_type)} · Ref. {missionShortRef(m.id)}
              </p>
              <p className="text-text-secondary" title={missionPriorityLabel(m.priority)}>
                {isDemo ? 'Demostración interna · ' : ''}
                {missionStatusLabel(m.status)} · P{m.priority}
              </p>
              <p className="mt-0.5 text-text-tertiary">
                Creada {formatGuatemalaDateTime(m.created_at)}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
