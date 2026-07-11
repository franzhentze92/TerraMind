import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/shared/utils/cn'

interface ResponsiveMapFrameProps {
  children: ReactNode
  className?: string
  minHeightClassName?: string
  ariaLabel?: string
}

/** Print-friendly map shell with minimum height and resize notification for Leaflet. */
export function ResponsiveMapFrame({
  children,
  className,
  minHeightClassName = 'min-h-[280px] sm:min-h-[360px] md:min-h-[420px]',
  ariaLabel = 'Mapa interactivo',
}: ResponsiveMapFrameProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      window.dispatchEvent(new Event('resize'))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('relative w-full overflow-hidden rounded-lg border border-border-subtle', minHeightClassName, className)}
      role="img"
      aria-label={ariaLabel}
    >
      {children}
    </div>
  )
}
