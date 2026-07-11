import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export interface StageLink {
  label: string
  to: string
}

interface StageNavigationLinksProps {
  links: StageLink[]
  emptyMessage?: string
}

/** Contextual CTAs along the intelligence chain (Phase 2 §6). */
export function StageNavigationLinks({ links, emptyMessage }: StageNavigationLinksProps) {
  if (links.length === 0) {
    if (!emptyMessage) return null
    return <p className="text-xs text-text-tertiary">{emptyMessage}</p>
  }

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.to + link.label}
          to={link.to}
          className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-2/40 px-3 py-1.5 text-xs text-text-secondary hover:border-accent/40 hover:text-text-primary"
        >
          {link.label}
          <ArrowRight className="h-3 w-3" />
        </Link>
      ))}
    </div>
  )
}
