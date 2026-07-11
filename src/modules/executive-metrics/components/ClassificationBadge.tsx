import type { DataClassification } from '@/modules/executive-metrics/metric-taxonomy'
import { classificationBadge } from '@/shared/product-language'

const STYLE: Record<DataClassification, string> = {
  operational: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  legacy: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  demo: 'border-violet-500/40 bg-violet-500/10 text-violet-200',
  pending: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
  excluded: 'border-zinc-500/40 bg-zinc-500/10 text-zinc-300',
  unresolved_ownership: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
}

/** Small badge marking a record's data classification (operacional / legacy / demostración). */
export function ClassificationBadge({ classification }: { classification: DataClassification }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${STYLE[classification]}`}
    >
      {classificationBadge(classification)}
    </span>
  )
}
