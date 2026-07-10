import type {
  BiodiversityContextDto,
  BiodiversityEnrichmentStateDto,
} from '@/modules/fires/types/fire.dto'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'
import {
  buildBiodiversityEventNarrative,
  topTaxaGroups,
} from '@/modules/fires/utils/biodiversity-narrative'

interface FireBiodiversitySectionProps {
  context?: BiodiversityContextDto | null
  enrichment?: BiodiversityEnrichmentStateDto | null
  isLoading?: boolean
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="font-mono text-text-primary">{value}</dd>
    </div>
  )
}

function qualityLabel(level: string): string {
  const map: Record<string, string> = {
    high: 'Alta',
    moderate: 'Moderada',
    limited: 'Limitada',
    very_limited: 'Muy limitada',
  }
  return map[level] ?? level
}

export function FireBiodiversitySection({
  context,
  enrichment,
  isLoading,
}: FireBiodiversitySectionProps) {
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
          Evidencia ecológica documentada
        </p>
        <p className="text-sm text-text-tertiary">
          {enrichment?.message ?? 'Contexto ecológico no calculado.'}
        </p>
      </div>
    )
  }

  const narrative = buildBiodiversityEventNarrative(context)
  const topTaxa = topTaxaGroups(context.summary.taxa_distribution)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Evidencia ecológica documentada
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-text-tertiary">{context.disclaimer}</p>
      </div>

      {narrative && <p className="text-sm leading-relaxed text-text-secondary">{narrative}</p>}

      <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3 space-y-2">
        <p className="text-xs font-medium text-text-primary">Resumen ecológico</p>
        <dl className="space-y-1.5">
          <MetricRow
            label="Especies documentadas"
            value={String(context.summary.unique_species_documented)}
          />
          <MetricRow
            label="Observaciones"
            value={String(context.summary.observations_documented)}
          />
          <MetricRow
            label="Recientes (30 d)"
            value={String(context.summary.observations_recent_30d)}
          />
          <MetricRow
            label="Calidad del contexto"
            value={qualityLabel(context.summary.quality.level)}
          />
        </dl>
        <div className="flex flex-wrap gap-2 pt-1 text-[11px] text-text-tertiary">
          {context.provider_status.gbif === 'ok' && (
            <span>GBIF: {context.summary.provider_distribution.gbif ?? '—'}</span>
          )}
          {context.provider_status.inaturalist === 'ok' && (
            <span>iNaturalist: {context.summary.provider_distribution.inaturalist ?? '—'}</span>
          )}
          {context.provider_status.gbif === 'error' && <span>GBIF no disponible</span>}
          {context.provider_status.inaturalist === 'error' && <span>iNaturalist no disponible</span>}
        </div>
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3 space-y-3">
        <p className="text-xs font-medium text-text-primary">Radios de análisis</p>
        {context.zones.map((zone) => (
          <div key={zone.radius_m} className="border-t border-border-subtle/60 pt-2 first:border-0 first:pt-0">
            <p className="text-[11px] font-medium text-text-secondary">{zone.radius_m / 1000} km</p>
            <dl className="mt-1 space-y-1">
              <MetricRow label="Especies" value={String(zone.unique_species_documented)} />
              <MetricRow label="Observaciones" value={String(zone.observations_documented)} />
              <MetricRow label="Recientes 30 d" value={String(zone.observations_recent_30d)} />
              {zone.spatially_excluded_count > 0 && (
                <MetricRow
                  label="Excluidas (precisión)"
                  value={String(zone.spatially_excluded_count)}
                />
              )}
            </dl>
          </div>
        ))}
      </div>

      {topTaxa.length > 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3 space-y-2">
          <p className="text-xs font-medium text-text-primary">Taxonomía documentada</p>
          <div className="space-y-1.5">
            {topTaxa.map((g) => {
              const max = topTaxa[0]?.count ?? 1
              const pct = Math.round((g.count / max) * 100)
              return (
                <div key={g.key}>
                  <div className="flex justify-between text-[11px] text-text-secondary">
                    <span>{g.label}</span>
                    <span className="font-mono">{g.count}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-surface-3">
                    <div
                      className="h-full rounded-full bg-accent/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {context.visual_highlights.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-text-primary">Evidencia visual</p>
          <div className="grid grid-cols-2 gap-2">
            {context.visual_highlights.slice(0, 6).map((v) => (
              <a
                key={`${v.source}-${v.taxon_name}`}
                href={v.observation_url ?? undefined}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-lg border border-border-subtle bg-surface-2/40 overflow-hidden hover:border-accent/40"
              >
                {v.thumbnail_url ? (
                  <img
                    src={v.thumbnail_url}
                    alt=""
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="aspect-square bg-surface-3" />
                )}
                <div className="px-2 py-1.5 text-[10px]">
                  <p className="font-medium text-text-primary truncate">
                    {v.common_name ?? v.taxon_name}
                  </p>
                  <p className="text-text-tertiary truncate">{v.source}</p>
                  {v.observed_at && (
                    <p className="text-text-tertiary">{formatGuatemalaDateTime(v.observed_at)}</p>
                  )}
                  {v.image_license && (
                    <p className="text-text-tertiary truncate">{v.image_license}</p>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {context.monitored_zone_context.zone_name && (
        <div className="rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-3 text-xs space-y-1">
          <p className="font-medium text-text-primary">Relación territorial</p>
          <p className="text-text-secondary">
            {context.monitored_zone_context.zone_name} — relación:{' '}
            {context.monitored_zone_context.relation}
          </p>
        </div>
      )}

      {(context.warnings.length > 0 || context.summary.quality.reasons.length > 0) && (
        <div className="text-[11px] text-text-tertiary space-y-1">
          <p className="font-medium text-text-secondary">Limitaciones</p>
          <ul className="list-disc pl-4 space-y-0.5">
            {[...new Set([...context.warnings, ...context.summary.quality.reasons])].map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
