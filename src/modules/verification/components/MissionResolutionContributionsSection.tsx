import { useQuery } from '@tanstack/react-query'
import { fetchMissionResolutionContributions } from '@/modules/verification/api/verification-api'
import { needResolutionStatusLabel } from '@/modules/verification/utils/verification-labels'

interface Props {
  missionId: string
}

export function MissionResolutionContributionsSection({ missionId }: Props) {
  const query = useQuery({
    queryKey: ['mission-resolution-contributions', missionId],
    queryFn: () => fetchMissionResolutionContributions(missionId),
  })

  const items = (query.data?.items as Array<Record<string, unknown>> | undefined) ?? []
  if (query.isLoading || items.length === 0) return null

  return (
    <section className="mb-6 rounded-lg border border-border-subtle bg-surface-2/30 p-4 text-sm">
      <h2 className="mb-2 text-sm font-semibold text-text-primary">
        Contribución a resolución de verificación
      </h2>
      <ul className="space-y-2 text-xs text-text-secondary">
        {items.map((item) => {
          const res = item.verification_need_resolutions as Record<string, unknown> | undefined
          return (
            <li key={String(item.id)} className="rounded border border-border-subtle/60 px-2 py-1.5">
              Need {String(res?.verification_need_id ?? '').slice(0, 8)}… ·{' '}
              {needResolutionStatusLabel(String(res?.resolution_status ?? 'open'))}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
