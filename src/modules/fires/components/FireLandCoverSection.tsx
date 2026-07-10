import type {
  LandCoverContextDto,
  LandCoverEnrichmentStateDto,
  LandCoverZoneDto,
} from '@/modules/fires/types/fire.dto'
import { LAND_COVER_EXPECTED_ZONE_RADII_M } from '@/modules/fires/config/land-cover.constants'
import { LandCoverDistributionBar } from '@/modules/fires/components/LandCoverDistributionBar'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { formatLandCoverPercentage } from '@/modules/fires/utils/land-cover-distribution'
import {
  buildLandCoverNarrative,
  buildLandCoverPointHeading,
  buildLandCoverPointSubtext,
  landCoverUiStateMessage,
  resolveLandCoverUiState,
} from '@/modules/fires/utils/land-cover-summary'
import { landCoverDisplayLabel } from '@/modules/territory/land-cover/land-cover-taxonomy'

interface FireLandCoverSectionProps {
  context?: LandCoverContextDto | null
  enrichment?: LandCoverEnrichmentStateDto | null
  isLoading?: boolean
}

function ZoneBlock({ zone, title }: { zone: LandCoverZoneDto; title: string }) {
  const dominantPct = zone.class_distribution[0]?.percentage
  const dominantLabel =
    zone.dominant_label ?? landCoverDisplayLabel(zone.dominant_class)

  return (
    <div className="space-y-2 rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        {title}
      </p>
      <div>
        <p className="text-xs text-text-tertiary">Cobertura dominante</p>
        <p className="text-sm font-medium text-text-primary">
          {dominantLabel}
          {dominantPct != null && (
            <span className="font-normal text-text-secondary">
              {' '}
              · {formatLandCoverPercentage(dominantPct)}%
            </span>
          )}
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-xs text-text-tertiary">Distribución</p>
        <LandCoverDistributionBar
          segments={zone.class_distribution.map((row) => ({
            class: row.class,
            label: row.label,
            percentage: row.percentage,
            area_ha: row.area_ha,
          }))}
        />
      </div>
      {zone.analyzed_area_ha != null && (
        <p className="text-[11px] text-text-tertiary">
          Área analizada: {zone.analyzed_area_ha.toFixed(1)} ha
          {zone.data_coverage_pct != null && (
            <> · Cobertura de datos: {formatLandCoverPercentage(zone.data_coverage_pct)}%</>
          )}
        </p>
      )}
    </div>
  )
}

export function FireLandCoverSection({ context, enrichment, isLoading }: FireLandCoverSectionProps) {
  const uiState = resolveLandCoverUiState({ isLoading, context })
  const stateMessage = landCoverUiStateMessage(uiState)

  if (isLoading) {
    return (
      <div className="mt-6 space-y-3 animate-pulse">
        <div className="h-4 w-40 rounded bg-surface-3" />
        <div className="h-20 rounded bg-surface-3" />
        <div className="h-28 rounded bg-surface-3" />
      </div>
    )
  }

  if (!context) {
    const queueMessage =
      enrichment?.status === 'queued' || enrichment?.status === 'processing'
        ? enrichment.message
        : enrichment?.message ?? stateMessage ?? 'Contexto de cobertura del suelo aún no calculado.'

    return (
      <div className="mt-6">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Cobertura del suelo
        </p>
        <p className="mt-2 text-sm text-text-tertiary">{queueMessage}</p>
        {enrichment?.status === 'failed' && (
          <p className="mt-2 text-[11px] text-text-tertiary">
            No se pudo completar el cálculo de cobertura del suelo.
          </p>
        )}
      </div>
    )
  }

  const zone500 = context.zones.find((z) => z.radius_m === 500)
  const zone1km = context.zones.find((z) => z.radius_m === 1000)
  const narrative = buildLandCoverNarrative(context.point_evidence, zone1km ?? null)
  const missingRadii = LAND_COVER_EXPECTED_ZONE_RADII_M.filter(
    (r) => !context.zones.some((z) => z.radius_m === r),
  )

  return (
    <div className="mt-6 space-y-4">
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Cobertura del suelo
      </p>

      {stateMessage && uiState !== 'complete' && (
        <p className="text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-400/90">
          {stateMessage}
        </p>
      )}

      <p className="text-sm leading-relaxed text-text-secondary">{narrative}</p>

      <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Cobertura en las detecciones
        </p>
        <p className="mt-2 text-sm font-medium text-text-primary">
          {buildLandCoverPointHeading(context.point_evidence)}
        </p>
        {context.point_evidence.mixed ? (
          <ul className="mt-2 space-y-1 text-xs text-text-secondary">
            {context.point_evidence.class_distribution.map((row) => (
              <li key={row.class}>
                {row.label}: {row.count} detección{row.count === 1 ? '' : 'es'}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-text-secondary">
            {buildLandCoverPointSubtext(context.point_evidence)}
          </p>
        )}
      </div>

      {zone500 && <ZoneBlock zone={zone500} title="Entorno de 500 m" />}
      {zone1km && <ZoneBlock zone={zone1km} title="Entorno de 1 km" />}

      {missingRadii.length > 0 && (
        <p className="text-[11px] text-text-tertiary">
          Zona{missingRadii.length > 1 ? 's' : ''} no disponible{missingRadii.length > 1 ? 's' : ''}:{' '}
          {missingRadii.map((r) => `${r} m`).join(', ')}.
        </p>
      )}

      {context.warnings.length > 0 && (
        <ul className="space-y-1 text-[11px] text-text-tertiary">
          {context.warnings.map((warning) => (
            <li key={warning}>· {warning}</li>
          ))}
        </ul>
      )}

      <dl className="grid grid-cols-2 gap-3 text-xs">
        <div className="col-span-2">
          <dt className="text-text-tertiary">Fuente</dt>
          <dd className="text-text-secondary">
            {context.source.name} {context.source.version}
          </dd>
        </div>
        <div>
          <dt className="text-text-tertiary">Resolución nominal</dt>
          <dd className="text-text-secondary">{context.source.resolution_m} m</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">Contexto calculado</dt>
          <dd className="text-text-secondary">
            {formatGuatemalaDateTime(context.generated_at)}
          </dd>
        </div>
      </dl>

      <p className="text-[11px] leading-relaxed text-text-tertiary">{context.disclaimer}</p>
    </div>
  )
}
