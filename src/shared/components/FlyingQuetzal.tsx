import { cn } from '@/shared/utils/cn'

interface FlyingQuetzalProps {
  direction?: 'ltr' | 'rtl'
  size?: number
  duration?: number
  delay?: number
  className?: string
  opacity?: number
}

export function FlyingQuetzal({
  direction = 'ltr',
  size = 96,
  duration = 14,
  delay = 0,
  className,
  opacity = 0.85,
}: FlyingQuetzalProps) {
  const isRtl = direction === 'rtl'

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-[1] overflow-hidden', className)}
      aria-hidden
    >
      <div
        className={cn(
          'quetzal-fly absolute top-1/2',
          isRtl ? 'quetzal-fly-rtl' : 'quetzal-fly-ltr',
        )}
        style={{
          marginTop: -size / 2,
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`,
        }}
      >
        <img
          src="/images/quetzal-flying.png"
          alt=""
          draggable={false}
          className={cn('block', isRtl && '-scale-x-100')}
          style={{ width: size, height: 'auto', opacity }}
        />
      </div>
    </div>
  )
}
