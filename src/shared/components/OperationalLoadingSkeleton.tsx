import { cn } from '@/shared/utils/cn'

export function OperationalListSkeleton({
  rows = 4,
  className,
}: {
  rows?: number
  className?: string
}) {
  return (
    <div className={cn('space-y-3', className)} data-testid="operational-list-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border-subtle bg-surface-2/30 p-4"
        >
          <div className="h-3 w-24 rounded bg-surface-2" />
          <div className="mt-3 h-4 w-2/3 rounded bg-surface-2" />
          <div className="mt-2 h-3 w-1/2 rounded bg-surface-2" />
        </div>
      ))}
    </div>
  )
}

export function OperationalDetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)} data-testid="operational-detail-skeleton">
      <div className="animate-pulse space-y-2">
        <div className="h-6 w-1/3 rounded bg-surface-2" />
        <div className="h-4 w-2/3 rounded bg-surface-2" />
      </div>
      <div className="animate-pulse rounded-xl border border-border-subtle p-6">
        <div className="h-4 w-full rounded bg-surface-2" />
        <div className="mt-3 h-4 w-5/6 rounded bg-surface-2" />
        <div className="mt-3 h-4 w-4/6 rounded bg-surface-2" />
      </div>
    </div>
  )
}

export function OperationalCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl border border-border-subtle bg-surface-2/30 p-5',
        className,
      )}
      data-testid="operational-card-skeleton"
    >
      <div className="h-8 w-8 rounded bg-surface-2" />
      <div className="mt-3 h-4 w-1/2 rounded bg-surface-2" />
      <div className="mt-2 h-3 w-full rounded bg-surface-2" />
    </div>
  )
}
