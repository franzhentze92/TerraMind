import type {
  PopulationContextDto,
  PopulationEnrichmentStateDto,
} from '@/modules/fires/types/fire.dto'
import { POPULATION_FIRE_EXPECTED_ZONE_RADII_M } from '@/modules/fires/config/population.constants'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import {
  formatPopulationCompact,
} from '@/modules/fires/utils/population-context.dto'
import { buildPopulationEventSummaryNarrative } from '@/modules/fires/utils/population-narrative'
import { formatPopulationZoneDisplay } from '@/modules/fires/utils/population-zone-display'
import { formatDistanceM } from '@/modules/fires/utils/proximity-label'

interface FirePopulationSectionProps {
  context?: PopulationContextDto | null
  enrichment?: PopulationEnrichmentStateDto | null
  isLoading?: boolean
}

export function FirePopulationSection({
  context,
  enrichment,
  isLoading,
}: FirePopulationSectionProps) {
  if (isLoading) {
    return (
      <div className="mt-6 space-y-3 animate-pulse">
        <div className="h-4 w-48 rounded bg-surface-3" />
        <div className="h-16 rounded bg-surface-3" />
      </div>
    )
  }

  if (!context) {
    return (
      <div className="mt-6 space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Población y asentamientos
        </p>
        <p className="text-sm text-text-tertiary">
          {enrichment?.message ?? 'Contexto poblacional no calculado.'}
        </p>
      </div>
    )
  }

  const nearest = context.nearest_settlements[0]
  const zone1km = context.zones.find((z) => z.radius_m === 1000)
  const summaryNarrative =
    zone1km != null
      ? buildPopulationEventSummaryNarrative({
          zone: zone1km,
          nearestSettlementName: nearest?.name,
          nearestSettlementDistanceM: nearest?.distance_m,
        })
      : null

  return (
    <div className="mt-6 space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Población y asentamientos
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">
          {context.disclaimer}
        </p>
      </div>

      {summaryNarrative && (
        <p className="text-sm leading-relaxed text-text-secondary">{summaryNarrative}</p>
      )}

      <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3">
        <p className="text-xs text-text-tertiary">Población residente estimada</p>
        <dl className="mt-2 space-y-3">
          {POPULATION_FIRE_EXPECTED_ZONE_RADII_M.map((radius) => {
            const zone = context.zones.find((z) => z.radius_m === radius)
            if (!zone) {
              return (
                <div key={radius}>
                  <dt className="text-text-tertiary">
                    {radius >= 1000 ? `${radius / 1000} km` : `${radius} m`}
                  </dt>
                  <dd className="font-mono text-text-primary">—</dd>
                </div>
              )
            }

            const display = formatPopulationZoneDisplay(zone)
            const radiusLabel = radius >= 1000 ? `${radius / 1000} km` : `${radius} m`

            return (
              <div key={radius}>
                <dt className="text-text-tertiary">{radiusLabel}</dt>
                <dd
                  className={
                    display.isRange
                      ? 'text-sm font-medium text-text-primary'
                      : 'font-mono text-text-primary'
                  }
                  title={display.tooltip}
                >
                  {display.primaryText}
                </dd>
                <dd className="mt-0.5 text-[11px] text-text-tertiary">{display.confidenceLabel}</dd>
              </div>
            )
          })}
        </dl>
      </div>

      {nearest && (
        <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3">
          <p className="text-xs text-text-tertiary">Cabecera municipal más cercana</p>
          <p className="mt-1 text-sm font-medium text-text-primary">
            {nearest.name}
            {nearest.municipality ? ` · ${nearest.municipality}` : ''}
            <span className="font-normal text-text-secondary">
              {' '}
              · {formatDistanceM(nearest.distance_m)}
            </span>
          </p>
          <p className="mt-2 text-[11px] text-text-tertiary">
            Fuente complementaria de asentamientos; no incluye necesariamente todas las aldeas
            y caseríos.
          </p>
        </div>
      )}

      {context.official_context.department && (
        <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3">
          <p className="text-xs text-text-tertiary">Contexto oficial departamental</p>
          <p className="mt-1 text-sm font-medium text-text-primary">
            {context.official_context.department.name}
          </p>
          <p className="text-sm text-text-secondary">
            Población{' '}
            {context.official_context.department.statistic_type === 'projection'
              ? 'proyectada'
              : 'censo'}{' '}
            {context.official_context.department.reference_year}:{' '}
            {formatPopulationCompact(context.official_context.department.official_population)}
          </p>
          <p className="text-[11px] text-text-tertiary">
            Contexto administrativo; no valida directamente la estimación del buffer.
          </p>
          <p className="text-[11px] text-text-tertiary">
            Fuente: {context.official_context.department.source}
          </p>
        </div>
      )}

      {!context.official_context.department && (
        <p className="text-[11px] text-text-tertiary">
          Dato oficial municipal no disponible en la importación actual.
        </p>
      )}

      {context.warnings.length > 0 && (
        <ul className="space-y-1 text-[11px] text-text-tertiary">
          {context.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}

      <p className="text-[11px] text-text-tertiary">
        Generado: {formatGuatemalaDateTime(context.generated_at)} · {context.source.name}{' '}
        {context.source.reference_year}
      </p>
    </div>
  )
}
