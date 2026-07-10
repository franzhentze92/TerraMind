import type {
  ClimateContextDto,
  ClimateEnrichmentStateDto,
} from '@/modules/fires/types/fire.dto'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import { buildClimateEventNarrative } from '@/modules/fires/utils/climate-narrative'

interface FireClimateSectionProps {
  context?: ClimateContextDto | null
  enrichment?: ClimateEnrichmentStateDto | null
  isLoading?: boolean
}

function fmt(value: number | null | undefined, suffix = ''): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(value < 10 ? 1 : 0)}${suffix}`
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="font-mono text-text-primary">{value}</dd>
    </div>
  )
}

export function FireClimateSection({
  context,
  enrichment,
  isLoading,
}: FireClimateSectionProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-48 rounded bg-surface-3" />
        <div className="h-24 rounded bg-surface-3" />
      </div>
    )
  }

  if (!context) {
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Condiciones meteorológicas modeladas
        </p>
        <p className="text-sm text-text-tertiary">
          {enrichment?.message ?? 'Contexto climático no calculado.'}
        </p>
      </div>
    )
  }

  const narrative = buildClimateEventNarrative(context)
  const ec = context.event_conditions

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Condiciones meteorológicas modeladas
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">{context.disclaimer}</p>
      </div>

      {narrative && <p className="text-sm leading-relaxed text-text-secondary">{narrative}</p>}

      <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3 space-y-2">
        <p className="text-xs font-medium text-text-primary">En el momento de detección</p>
        <dl className="space-y-1.5">
          <MetricRow label="Temperatura" value={`${fmt(ec.temperature_c?.mean)} °C`} />
          <MetricRow label="Humedad relativa" value={`${fmt(ec.relative_humidity_pct?.mean, '%')}`} />
          <MetricRow label="Viento medio" value={`${fmt(ec.wind_speed_kmh?.mean)} km/h`} />
          <MetricRow label="Ráfaga" value={`${fmt(ec.wind_gust_kmh?.max)} km/h`} />
          <MetricRow
            label="Dirección"
            value={
              ec.wind_direction?.cardinal && ec.wind_direction?.toward_cardinal
                ? `${ec.wind_direction.cardinal} → ${ec.wind_direction.toward_cardinal}`
                : '—'
            }
          />
          <MetricRow label="Precipitación horaria" value={`${fmt(ec.precipitation_mm?.mean)} mm`} />
        </dl>
        {ec.matched_time && (
          <p className="text-[11px] text-text-tertiary">
            Hora modelada emparejada: {formatGuatemalaDateTime(ec.matched_time)}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3 space-y-2">
        <p className="text-xs font-medium text-text-primary">Condiciones previas</p>
        <dl className="space-y-1.5">
          <MetricRow
            label="Lluvia 24 h"
            value={`${fmt(context.antecedent.precipitation_previous_24h_mm)} mm`}
          />
          <MetricRow
            label="Lluvia 7 días"
            value={`${fmt(context.antecedent.precipitation_previous_7d_mm)} mm`}
          />
          <MetricRow
            label="Lluvia 30 días"
            value={`${fmt(context.antecedent.precipitation_previous_30d_mm)} mm`}
          />
          <MetricRow
            label="Días secos consecutivos"
            value={fmt(context.antecedent.dry_days_consecutive)}
          />
        </dl>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3 space-y-2">
        <p className="text-xs font-medium text-text-primary">Pronóstico modelado</p>
        {!context.forecast.available ? (
          <p className="text-sm text-text-tertiary">Pronóstico no disponible para este evento.</p>
        ) : (
          <dl className="space-y-1.5">
            <MetricRow
              label="Lluvia próx. 24 h"
              value={`${fmt(context.forecast.precipitation_next_24h_mm)} mm`}
            />
            <MetricRow
              label="Lluvia próx. 72 h"
              value={`${fmt(context.forecast.precipitation_next_72h_mm)} mm`}
            />
            <MetricRow
              label="Viento máx. 24 h"
              value={`${fmt(context.forecast.max_wind_speed_next_24h_kmh)} km/h`}
            />
            <MetricRow
              label="Ráfaga máx. 24 h"
              value={`${fmt(context.forecast.max_wind_gust_next_24h_kmh)} km/h`}
            />
          </dl>
        )}
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3 space-y-1">
        <p className="text-xs font-medium text-text-primary">Fuente y calidad</p>
        <p className="text-sm text-text-secondary">
          {context.source.provider} · {context.source.model}
        </p>
        <p className="text-[11px] text-text-tertiary">
          Puntos consultados: {context.spatial_variability.point_count} · Variabilidad{' '}
          {context.spatial_variability.level} · Alineación temporal {context.temporal_alignment}
        </p>
        {context.warnings.length > 0 && (
          <ul className="mt-2 space-y-1 text-[11px] text-amber-600 dark:text-amber-400">
            {context.warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-text-tertiary">
          Generado: {formatGuatemalaDateTime(context.source.generated_at)}
        </p>
      </div>
    </div>
  )
}
