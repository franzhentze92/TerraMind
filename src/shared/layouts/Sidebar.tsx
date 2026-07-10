import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  Search,
  AlertCircle,
  Brain,
  Layers,
  CheckCircle2,
  Map,
  TrendingUp,
  FileText,
  BookOpen,
  Plug,
  Settings,
  Globe,
  Flame,
  Leaf,
} from 'lucide-react'
import { cn } from '@/shared/utils/cn'
import { APP_CONFIG } from '@/core/config'
import { useTerritoryStore } from '@/core/config/territory.store'

interface NavItem {
  path: string
  label: string
  icon: typeof Home
}

interface NavSection {
  title: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Monitoreo',
    items: [
      { path: '/incendios', label: 'Incendios', icon: Flame },
      { path: '/biodiversidad', label: 'Biodiversidad', icon: Leaf },
    ],
  },
  {
    title: 'Centro Nacional',
    items: [{ path: '/situacion', label: 'Situación Nacional', icon: Home }],
  },
  {
    title: 'Inteligencia',
    items: [
      { path: '/hallazgos', label: 'Hallazgos', icon: Search },
      { path: '/prioridades', label: 'Prioridades', icon: AlertCircle },
      { path: '/incidentes', label: 'Incidentes', icon: Layers },
      { path: '/verificaciones', label: 'Verificaciones', icon: CheckCircle2 },
      { path: '/copilot', label: 'Copilot', icon: Brain },
    ],
  },
  {
    title: 'Análisis',
    items: [
      { path: '/territorio', label: 'Territorio', icon: Map },
      { path: '/tendencias', label: 'Tendencias', icon: TrendingUp },
      { path: '/informes', label: 'Informes', icon: FileText },
    ],
  },
  {
    title: 'Conocimiento',
    items: [
      { path: '/conocimiento', label: 'Conocimiento', icon: BookOpen },
      { path: '/fuentes', label: 'Integraciones', icon: Plug },
    ],
  },
  {
    title: 'Sistema',
    items: [{ path: '/administracion', label: 'Administración', icon: Settings }],
  },
]

export function Sidebar() {
  const territory = useTerritoryStore((s) => s.territory)

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border-subtle bg-surface-1">
      <div className="flex h-10 items-center gap-2.5 border-b border-border-subtle px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-subtle">
          <Globe className="h-3.5 w-3.5 text-accent" />
        </div>
        <p className="truncate text-sm font-semibold text-text-primary">{APP_CONFIG.name}</p>
      </div>

      <div className="border-b border-border-subtle px-4 py-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Territorio activo
        </p>
        <p className="mt-0.5 text-sm font-medium text-text-primary">{territory.countryName}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4 last:mb-0">
            <p className="mb-1 px-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              {section.title}
            </p>
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                        isActive
                          ? 'text-text-primary'
                          : 'text-text-secondary hover:text-text-primary',
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
                        <item.icon className="relative h-4 w-4 shrink-0" />
                        <span className="relative">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border-subtle px-4 py-2.5">
        <p className="text-[10px] text-text-tertiary">v{APP_CONFIG.version}</p>
      </div>
    </aside>
  )
}
