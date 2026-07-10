import { NavLink, Outlet } from 'react-router-dom'

import { probeFieldConnectivity } from '@/modules/field-operations/field-mobile/engine/field-connectivity'
import { labelConnectivity, t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'
import { useEffect, useState } from 'react'
import { cn } from '@/shared/utils/cn'

const NAV = [
  { to: '/campo', end: true, label: 'Inicio' },
  { to: '/campo/misiones', label: 'Misiones' },
  { to: '/campo/paquetes', label: 'Paquetes' },
  { to: '/campo/sincronizacion', label: 'Sync' },
  { to: '/campo/conflictos', label: 'Alertas' },
]

export function FieldCampoLayout() {
  const [connectivity, setConnectivity] = useState('offline')

  useEffect(() => {
    void probeFieldConnectivity().then((r) => setConnectivity(r.state))
    const refresh = () => void probeFieldConnectivity().then((r) => setConnectivity(r.state))
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    return () => {
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-0">
      <header className="shrink-0 border-b border-border-subtle bg-surface-1 px-4 py-3 md:hidden">
        <p className="text-sm font-medium text-text-primary">TerraMind Campo</p>
        <p className="text-xs text-text-secondary">{labelConnectivity(connectivity)}</p>
        <p className="text-xs text-confidence-medium">{t('work_local_only', 'es')}</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-4">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-surface-1/95 backdrop-blur md:static md:border-t-0">
        <ul className="mx-auto flex max-w-lg justify-around px-1 py-2">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 min-w-14 flex-col items-center justify-center rounded-lg px-2 text-xs',
                    isActive ? 'text-accent font-medium' : 'text-text-secondary',
                  )
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
