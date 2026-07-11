import { DataQualityCard } from '@/modules/executive-metrics/components/DataQualityCard'
import { useNationalSituation } from '../../NationalSituationContext'
import { TopFindings } from '../TopFindings'
import { IncidentsOverview } from '../IncidentsOverview'

export function PanoramaTab() {
  const { dqQuery } = useNationalSituation()

  return (
    <div className="space-y-4" data-testid="tab-panorama">
      <TopFindings />
      <IncidentsOverview />
      {dqQuery.data && <DataQualityCard summary={dqQuery.data} />}
      {dqQuery.isError && (
        <div className="rounded-lg border border-red-500/30 px-4 py-3 text-sm text-red-200">
          No se pudo cargar calidad de datos.{' '}
          <button type="button" onClick={() => dqQuery.refetch()} className="underline">
            Reintentar
          </button>
        </div>
      )}
    </div>
  )
}
