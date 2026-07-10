import type { ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-surface-2',
        paddingStyles[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}
