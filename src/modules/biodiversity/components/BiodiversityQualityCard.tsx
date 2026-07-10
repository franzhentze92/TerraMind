interface BiodiversityQualityCardProps {
  quality: {
    coordinate_completeness_pct: number
    research_grade_pct: number
    obscured_count: number
    captive_count: number
    unknown_license_count: number
    possible_duplicate_count: number
    notes: string[]
  }
  className?: string
}

export function BiodiversityQualityCard({ quality, className }: BiodiversityQualityCardProps) {
  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Metric label="Coordenadas" value={`${quality.coordinate_completeness_pct}%`} />
        <Metric label="Research grade" value={`${quality.research_grade_pct}%`} />
        <Metric label="Generalizados" value={quality.obscured_count} />
        <Metric label="Cautiverio" value={quality.captive_count} />
        <Metric label="Licencia desconocida" value={quality.unknown_license_count} />
        <Metric label="Posibles duplicados" value={quality.possible_duplicate_count} />
      </div>
      {quality.notes.length > 0 && (
        <ul className="mt-4 space-y-1 text-xs text-text-tertiary">
          {quality.notes.map((note) => (
            <li key={note}>· {note}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-1/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <p className="font-semibold text-text-primary">{value}</p>
    </div>
  )
}
