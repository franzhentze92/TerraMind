import { useNationalSituation } from '../NationalSituationContext'
import { SITUATION_PERIOD_OPTIONS } from '../national-situation.constants'

export function SituationPeriodSelector() {
  const { period, setPeriod } = useNationalSituation()

  return (
    <select
      value={period}
      onChange={(e) => setPeriod(e.target.value as typeof period)}
      className="rounded-lg border border-border-subtle bg-surface-1 px-2 py-1.5 text-xs text-text-secondary"
      aria-label="Período de consulta"
      data-testid="situation-period-selector"
    >
      {SITUATION_PERIOD_OPTIONS.map((opt) => (
        <option key={opt.key} value={opt.key}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
