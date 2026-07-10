import { Link } from 'react-router-dom'
import { useIncidentMissions } from '../hooks/useMissions'
import { missionStatusLabel } from '../utils/mission-labels'

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
        {items.map((m) => (
          <Link
            key={m.id}
            to={`/misiones/${m.id}`}
            className="block rounded border border-border-subtle/60 px-3 py-2 text-xs hover:border-accent/40"
          >
            <p className="font-medium text-text-primary">{m.title}</p>
            <p className="text-text-tertiary">
              {missionStatusLabel(m.status)} · P{m.priority}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
