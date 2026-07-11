import { cn } from '@/shared/utils/cn'
import type { FieldSyncStatus } from '@/modules/field-operations/field-sync/field-sync-status'

const TONE_STYLES: Record<FieldSyncStatus['tone'], string> = {
  neutral: 'border-border-subtle bg-surface-2/30 text-text-secondary',
  info: 'border-accent/30 bg-accent/5 text-text-secondary',
  warning: 'border-confidence-medium/30 bg-confidence-medium/10 text-confidence-medium',
  critical: 'border-confidence-low/30 bg-confidence-low/10 text-confidence-low',
  success: 'border-confidence-high/30 bg-confidence-high/10 text-text-secondary',
}

const DOT_STYLES: Record<FieldSyncStatus['tone'], string> = {
  neutral: 'bg-text-tertiary',
  info: 'bg-accent',
  warning: 'bg-confidence-medium',
  critical: 'bg-confidence-low',
  success: 'bg-confidence-high',
}

/**
 * Renders the single canonical Field Sync status. Never combine with other
 * connectivity/sync banners — this is the sole source of truth on screen.
 */
export function FieldSyncStatusCard({
  status,
  className,
}: {
  status: FieldSyncStatus
  className?: string
}) {
  return (
    <div
      className={cn('rounded-lg border px-4 py-3 text-sm', TONE_STYLES[status.tone], className)}
      data-testid="field-sync-status"
      data-sync-state={status.state}
    >
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT_STYLES[status.tone])} />
        <p className="font-medium text-text-primary">{status.label}</p>
      </div>
      <p className="mt-1 pl-4 text-xs text-text-tertiary">{status.description}</p>
    </div>
  )
}
