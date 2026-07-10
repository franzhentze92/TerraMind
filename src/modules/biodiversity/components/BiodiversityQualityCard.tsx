import type { BiodiversityDashboardQualitySummary } from '@/modules/biodiversity/dto/biodiversity-dashboard.dto'

interface BiodiversityQualityCardProps {
  quality: BiodiversityDashboardQualitySummary
  className?: string
}

export function BiodiversityQualityCard({ quality, className }: BiodiversityQualityCardProps) {
  const researchLabel =
    quality.inaturalist_research_grade != null
      ? `${quality.inaturalist_research_grade.count} de ${quality.inaturalist_research_grade.total} iNat`
      : 'N/D'

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Metric
          label="Coordenadas"
          value={`${quality.coordinate_completeness_pct}%`}
          title="Registros con ubicación presente (exacta o generalizada) respecto al total de la muestra."
        />
        <Metric
          label="Research iNat"
          value={researchLabel}
          title="Grado de investigación solo aplica a observaciones iNaturalist."
        />
        <Metric label="Generalizados" value={quality.obscured_count} />
        <Metric label="Cautiverio" value={quality.captive_count} />
        <Metric label="Licencia desconocida" value={quality.unknown_license_count} />
        <Metric label="Posibles duplicados" value={quality.possible_duplicate_count} />
      </div>
      {quality.truncated && (
        <p className="mt-3 text-xs text-confidence-medium">
          Resultado parcial: la muestra alcanzó el límite por zona.
        </p>
      )}
      {quality.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-text-tertiary">
          {quality.notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Metric({
  label,
  value,
  title,
}: {
  label: string
  value: string | number
  title?: string
}) {
  return (
    <div
      className="rounded-md border border-border-subtle bg-surface-1/40 px-3 py-2"
      title={title}
    >
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="font-semibold text-text-primary">{value}</p>
    </div>
  )
}
