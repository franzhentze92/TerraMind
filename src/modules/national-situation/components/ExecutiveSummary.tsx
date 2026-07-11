import { useNationalSituation } from '../NationalSituationContext'

const ITEMS = [
  ['Qué ocurre', 'what_is_happening'],
  ['Qué cambió', 'what_changed'],
  ['Requiere atención', 'requires_attention'],
  ['En verificación', 'in_verification'],
  ['Recomienda TerraMind', 'terramind_recommends'],
] as const

export function ExecutiveSummary() {
  const { summary } = useNationalSituation()

  return (
    <section
      className="rounded-xl border border-border-subtle bg-surface-2/40 px-4 py-3"
      data-testid="executive-summary"
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        Resumen ejecutivo
      </p>
      <ul className="mt-2 space-y-2">
        {ITEMS.map(([label, key]) => (
          <li key={key} className="text-sm">
            <span className="font-medium text-accent">{label}: </span>
            <span className="text-text-secondary">{summary[key]}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
