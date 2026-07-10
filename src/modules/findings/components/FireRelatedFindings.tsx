import { Link } from 'react-router-dom'
import { Badge } from '@/shared/components/Badge'
import type { FindingDetailDto } from '../api/findings-api'
import {
  findingConfidenceLabel,
  findingSeverityLabel,
  findingStatusLabel,
} from '../utils/finding-labels'

interface FireRelatedFindingsProps {
  findings?: FindingDetailDto[]
  isLoading?: boolean
}

export function FireRelatedFindings({ findings, isLoading }: FireRelatedFindingsProps) {
  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-lg bg-surface-3" />
  }

  if (!findings?.length) {
    return (
      <p className="text-sm text-text-tertiary">No hay hallazgos compuestos activos para este evento.</p>
    )
  }

  return (
    <div className="space-y-2">
      {findings.slice(0, 5).map((f) => (
        <Link
          key={f.id}
          to={`/hallazgos/${f.id}`}
          className="block rounded-lg border border-border-subtle bg-surface-2/30 px-3 py-2 hover:border-accent/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-text-primary">{f.title}</p>
            <div className="flex gap-1">
              <Badge variant="default">{findingSeverityLabel(f.severity_label)}</Badge>
              <Badge variant="default">{findingConfidenceLabel(f.confidence.level)}</Badge>
              <Badge variant="default">{findingStatusLabel(f.status)}</Badge>
            </div>
          </div>
          <p className="mt-1 text-xs text-text-tertiary line-clamp-2">{f.summary}</p>
        </Link>
      ))}
    </div>
  )
}
