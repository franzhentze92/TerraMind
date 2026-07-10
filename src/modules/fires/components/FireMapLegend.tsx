import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { RISK_MAP_STYLES } from '@/modules/fires/utils/map-styles'
import { cn } from '@/shared/utils/cn'

export function FireMapLegend({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'rounded-lg border border-border-subtle bg-surface-1/95 text-[11px] text-text-secondary shadow-sm backdrop-blur-sm',
        className,
      )}
      aria-label="Leyenda del mapa"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-medium text-text-primary"
        aria-expanded={open}
      >
        Leyenda
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border-subtle px-3 pb-3 pt-2">
          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Prioridad
            </p>
            <ul className="space-y-1">
              <LegendSwatch color={RISK_MAP_STYLES.atencion.fill} label="Atención" shape="disc" />
              <LegendSwatch color={RISK_MAP_STYLES.observacion.fill} label="Observación" shape="disc" />
              <LegendSwatch
                color={RISK_MAP_STYLES.informativo.fill}
                label="Informativo"
                shape="disc"
                dashed
              />
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Capas
            </p>
            <ul className="space-y-1">
              <LegendSwatch color={RISK_MAP_STYLES.atencion.fill} label="Evento térmico" shape="ring" />
              <LegendSwatch color="#38bdf8" label="Detección satelital" shape="dot" />
            </ul>
          </div>

          <div>
            <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Validación
            </p>
            <ul className="space-y-1">
              <LegendBorder label="Probable" style="solid" />
              <LegendBorder label="No validado" style="dashed" />
              <LegendBorder label="Confirmado" style="solid-thick" />
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

function LegendSwatch({
  color,
  label,
  shape,
  dashed,
}: {
  color: string
  label: string
  shape: 'disc' | 'dot' | 'ring'
  dashed?: boolean
}) {
  return (
    <li className="flex items-center gap-2">
      {shape === 'disc' && (
        <span
          className={cn('h-3 w-3 rounded-full border', dashed && 'border-dashed')}
          style={{ backgroundColor: color, borderColor: color }}
        />
      )}
      {shape === 'dot' && (
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      )}
      {shape === 'ring' && (
        <span
          className="h-3 w-3 rounded-full border-2 bg-transparent"
          style={{ borderColor: color }}
        />
      )}
      <span>{label}</span>
    </li>
  )
}

function LegendBorder({
  label,
  style,
}: {
  label: string
  style: 'solid' | 'dashed' | 'solid-thick'
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={cn(
          'h-0 w-5 border-t-2',
          style === 'dashed' && 'border-dashed',
          style === 'solid-thick' && 'border-t-[3px]',
        )}
        style={{ borderColor: '#9ca3af' }}
      />
      <span>{label}</span>
    </li>
  )
}
