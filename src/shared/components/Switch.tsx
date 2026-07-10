import { cn } from '@/shared/utils/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  id?: string
  'aria-label'?: string
  className?: string
}

export function Switch({
  checked,
  onChange,
  id,
  'aria-label': ariaLabel,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 rounded-full border border-border-subtle transition-colors',
        checked ? 'bg-accent' : 'bg-surface-3',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  )
}
