import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home,
  Search,
  AlertCircle,
  Brain,
  Layers,
  CheckCircle2,
  ClipboardList,
  Shield,
  Map,
  TrendingUp,
  FileText,
  Plug,
  Settings,
  Globe,
  Flame,
  Leaf,
  Users,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  X,
} from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { APP_CONFIG } from '@/core/config'
import { useAuth } from '@/core/auth/AuthProvider'
import { OrganizationSelector } from '@/modules/auth/components/OrganizationSelector'
import {
  NAV_SECTION_LABELS,
  getPrimaryNavForSection,
  type NavSectionKey,
  type RouteRegistryEntry,
} from '@/shared/navigation/navigation-registry'
import { canSeeNavItem, isFieldTechnicianOnly } from '@/shared/navigation/role-navigation'
import { useSidebarLayout } from './SidebarLayoutContext'
import { useDashboardEventTypes } from '@/modules/national-situation/hooks/useDashboardEventTypes'
import { resolveEventTypeIcon } from '@/modules/environmental-events/ui/EventTypeIcon'

/** Static monitoreo routes that already have a dedicated page (no dynamic entry). */
const STATIC_EVENT_TYPE_ROUTES: Record<string, string> = {
  thermal_activity: '/incendios',
}

const SECTION_ORDER: NavSectionKey[] = [
  'monitoreo',
  'inteligencia',
  'operaciones',
  'campo',
  'analisis',
  'administracion',
]

const ICON_BY_PATH: Record<string, typeof Home> = {
  '/situacion': Home,
  '/incendios': Flame,
  '/biodiversidad': Leaf,
  '/territorio': Map,
  '/hallazgos': Search,
  '/noticias': Globe,
  '/prioridades': AlertCircle,
  '/incidentes': Layers,
  '/verificaciones': CheckCircle2,
  '/misiones': ClipboardList,
  '/respuesta': Shield,
  '/campo': Smartphone,
  '/tendencias': TrendingUp,
  '/informes': FileText,
  '/copilot': Brain,
  '/admin/organizacion': Users,
  '/fuentes': Plug,
  '/administracion': Settings,
}

const SIDEBAR_COLLAPSED_KEY = 'terramind-sidebar-collapsed'

function initialCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
  if (saved !== null) return saved === '1'
  const w = window.innerWidth
  if (w < 1024) return true
  return false
}

function NavItemLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: RouteRegistryEntry
  collapsed: boolean
  onNavigate?: () => void
}) {
  const Icon = ICON_BY_PATH[item.path] ?? Map
  return (
    <li>
      <NavLink
        to={item.path}
        title={collapsed ? item.title : undefined}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
            isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
            collapsed && 'justify-center px-2',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-md bg-surface-3"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <Icon className="relative h-4 w-4 shrink-0" />
            {!collapsed && <span className="relative truncate">{item.title}</span>}
          </>
        )}
      </NavLink>
    </li>
  )
}

function DynamicNavLink({
  path,
  title,
  Icon,
  collapsed,
  onNavigate,
}: {
  path: string
  title: string
  Icon: typeof Home
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <li>
      <NavLink
        to={path}
        title={collapsed ? title : undefined}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
            isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
            collapsed && 'justify-center px-2',
          )
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <motion.div
                layoutId="sidebar-active"
                className="absolute inset-0 rounded-md bg-surface-3"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            )}
            <Icon className="relative h-4 w-4 shrink-0" />
            {!collapsed && <span className="relative truncate">{title}</span>}
          </>
        )}
      </NavLink>
    </li>
  )
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const { authContext } = useAuth()
  const { types: enabledEventTypes } = useDashboardEventTypes()

  // Registry-driven monitoreo entries for enabled types without a dedicated
  // static page (thermal already lives at /incendios). Grows automatically as
  // new types are enabled server-side; no hardcoded per-type list.
  const dynamicMonitoreo = useMemo(
    () =>
      enabledEventTypes
        .filter((t) => !STATIC_EVENT_TYPE_ROUTES[t.type])
        .map((t) => ({
          path: `/eventos/tipo/${t.type}`,
          title: t.label,
          Icon: resolveEventTypeIcon(t.icon),
        })),
    [enabledEventTypes],
  )

  const visibleSections = useMemo(() => {
    const fieldOnly = isFieldTechnicianOnly(authContext)
    const sections = fieldOnly ? (['campo'] as NavSectionKey[]) : SECTION_ORDER

    return sections
      .map((key) => ({
        key,
        title: NAV_SECTION_LABELS[key],
        items: getPrimaryNavForSection(key).filter((item) => canSeeNavItem(item, authContext)),
      }))
      .filter((s) => s.items.length > 0)
  }, [authContext])

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-3">
      <AnimatePresence initial={false}>
        {visibleSections.map((section) => (
          <div key={section.key} className="mb-4 last:mb-0">
            {!collapsed && (
              <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {section.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <NavItemLink
                  key={item.path}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
              {section.key === 'monitoreo' &&
                dynamicMonitoreo.map((d) => (
                  <DynamicNavLink
                    key={d.path}
                    path={d.path}
                    title={d.title}
                    Icon={d.Icon}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                ))}
            </ul>
          </div>
        ))}
      </AnimatePresence>
    </nav>
  )
}

function SidebarChrome({
  collapsed,
  setCollapsed,
  showCollapseToggle,
  onCloseMobile,
  mobile,
}: {
  collapsed: boolean
  setCollapsed: (v: boolean | ((c: boolean) => boolean)) => void
  showCollapseToggle: boolean
  onCloseMobile?: () => void
  mobile?: boolean
}) {
  return (
    <>
      <div className="flex h-10 items-center gap-2 border-b border-border-subtle px-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-subtle">
          <Globe className="h-3.5 w-3.5 text-accent" />
        </div>
        {!collapsed && (
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
            {APP_CONFIG.name}
          </p>
        )}
        {mobile && onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded p-1 text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {showCollapseToggle && !mobile && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1 text-text-tertiary hover:bg-surface-3 hover:text-text-primary"
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      {!collapsed && (
        <div className="border-b border-border-subtle px-4 py-2.5">
          <OrganizationSelector />
        </div>
      )}
    </>
  )
}

export function Sidebar() {
  const location = useLocation()
  const { mobileOpen, closeMobile, isMobile } = useSidebarLayout()
  const [collapsed, setCollapsed] = useState(initialCollapsed)

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const inCampo = location.pathname.startsWith('/campo')

  const desktopAside = (
    <aside
      className={cn(
        'h-full flex-col border-r border-border-subtle bg-surface-1 transition-[width]',
        inCampo ? 'hidden md:flex' : 'hidden md:flex',
        collapsed ? 'w-14' : 'w-56',
      )}
      aria-label="Navegación principal"
    >
      <SidebarChrome collapsed={collapsed} setCollapsed={setCollapsed} showCollapseToggle />
      <SidebarNav collapsed={collapsed} />
    </aside>
  )

  return (
    <>
      {desktopAside}

      {isMobile && !inCampo && mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Cerrar menú"
            onClick={closeMobile}
          />
          <aside className="relative flex h-full w-[min(100%,280px)] flex-col bg-surface-1 shadow-xl">
            <SidebarChrome
              collapsed={false}
              setCollapsed={setCollapsed}
              showCollapseToggle={false}
              onCloseMobile={closeMobile}
              mobile
            />
            <SidebarNav collapsed={false} onNavigate={closeMobile} />
          </aside>
        </div>
      )}
    </>
  )
}
