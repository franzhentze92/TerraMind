import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'critical'
  className?: string
}

const variantStyles = {
  default: 'bg-surface-3 text-text-secondary border-border-default',
  accent: 'bg-accent-subtle text-accent border-accent-muted/30',
  success: 'bg-confidence-high/10 text-confidence-high border-confidence-high/20',
  warning: 'bg-confidence-medium/10 text-confidence-medium border-confidence-medium/20',
  critical: 'bg-confidence-low/10 text-confidence-low border-confidence-low/20',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
