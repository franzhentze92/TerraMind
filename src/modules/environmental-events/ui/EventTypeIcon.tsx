/**
 * Environmental Event Framework — icon resolver.
 *
 * Maps the manifest `icon` string (a stable, framework-owned key) to a real
 * lucide-react component. The manifest remains the single source of truth for a
 * type's icon; this resolver only renders it. Unknown keys fall back to a
 * neutral marker so the UI never crashes when a new type is registered.
 */
import {
  Activity,
  CloudRain,
  Droplets,
  Flame,
  Leaf,
  MapPin,
  Mountain,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react'

const ICON_BY_KEY: Record<string, LucideIcon> = {
  flame: Flame,
  'cloud-rain': CloudRain,
  droplet: Droplets,
  droplets: Droplets,
  leaf: Leaf,
  mountain: Mountain,
  waves: Waves,
  wind: Wind,
  'map-pin': MapPin,
  activity: Activity,
}

export function resolveEventTypeIcon(iconKey: string): LucideIcon {
  return ICON_BY_KEY[iconKey] ?? Activity
}

interface EventTypeIconProps {
  /** Manifest icon key (e.g. `flame`, `cloud-rain`). */
  icon: string
  /** Accent color from `manifest.accentColor` (single visual source of truth). */
  color?: string
  size?: number
  className?: string
  'aria-hidden'?: boolean
}

export function EventTypeIcon({
  icon,
  color,
  size = 16,
  className,
  'aria-hidden': ariaHidden = true,
}: EventTypeIconProps) {
  const Icon = resolveEventTypeIcon(icon)
  return (
    <Icon size={size} className={className} style={color ? { color } : undefined} aria-hidden={ariaHidden} />
  )
}
