import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

/** Accessible breadcrumb trail — never shows raw UUIDs (Phase 2 §7). */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null

  return (
    <nav aria-label="Ruta de navegación" className={cn('text-xs text-text-tertiary', className)}>
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const isLast = i === items.length - 1
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-50" aria-hidden />}
              {item.to && !isLast ? (
                <Link to={item.to} className="hover:text-text-primary">
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'font-medium text-text-secondary' : undefined}>{item.label}</span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
