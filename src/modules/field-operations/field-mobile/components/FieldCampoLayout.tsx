import { NavLink, Outlet } from 'react-router-dom'

import { probeFieldConnectivity } from '@/modules/field-operations/field-mobile/engine/field-connectivity'
import { labelConnectivity, t } from '@/modules/field-operations/field-mobile/i18n/field-mobile-i18n'
import { CAMPO_SECONDARY_NAV } from '@/shared/navigation/navigation-registry'
import { useEffect, useState } from 'react'
import { cn } from '@/shared/utils/cn'

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
      <header className="shrink-0 border-b border-border-subtle bg-surface-1 px-4 py-3">
        <p className="text-sm font-medium text-text-primary">Campo · Mi trabajo</p>
        <p className="text-xs text-text-secondary">{labelConnectivity(connectivity)}</p>
        <p className="text-xs text-confidence-medium">{t('work_local_only', 'es')}</p>
        <nav className="mt-3 hidden overflow-x-auto md:flex md:gap-1">
          {CAMPO_SECONDARY_NAV.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-xs',
                  isActive
                    ? 'bg-surface-3 font-medium text-text-primary'
                    : 'text-text-tertiary hover:text-text-primary',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-4">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-surface-1/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg justify-around px-1 py-2">
          {CAMPO_SECONDARY_NAV.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={'end' in item ? item.end : false}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 min-w-12 flex-col items-center justify-center rounded-lg px-1 text-[10px]',
                    isActive ? 'font-medium text-accent' : 'text-text-secondary',
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
