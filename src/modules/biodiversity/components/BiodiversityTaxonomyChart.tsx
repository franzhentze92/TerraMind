interface BiodiversityTaxonomyChartProps {
  distribution: Record<string, number>
  className?: string
}

export function BiodiversityTaxonomyChart({
  distribution,
  className,
}: BiodiversityTaxonomyChartProps) {
  const entries = Object.entries(distribution).sort(([, a], [, b]) => b - a)
  const max = entries[0]?.[1] ?? 1

  if (entries.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Sin grupos taxonómicos resueltos en la muestra.
      </p>
    )
  }

  return (
    <div className={className}>
      <p className="mb-3 text-xs font-medium text-text-secondary">Distribución taxonómica</p>
      <div className="space-y-2">
        {entries.map(([group, count]) => (
          <div key={group}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-text-secondary">{group}</span>
              <span className="text-text-tertiary">{count}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full rounded-full bg-accent/70"
                style={{ width: `${Math.max(4, (count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
