import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { OperationalDetailSkeleton } from '@/shared/components'
import { ErrorBoundary } from '@/shared/components/ErrorBoundary'
import { Sidebar } from './Sidebar'
import { SidebarLayoutProvider, useSidebarLayout } from './SidebarLayoutContext'

function MobileAppHeader() {
  const { isMobile, openMobile } = useSidebarLayout()
  if (!isMobile) return null

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border-subtle bg-surface-1 px-3 md:hidden">
      <button
        type="button"
        onClick={openMobile}
        className="rounded-md p-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary"
        aria-label="Abrir menú de navegación"
      >
        <Menu className="h-5 w-5" />
      </button>
      <p className="truncate text-sm font-semibold text-text-primary">TerraMind</p>
    </header>
  )
}

function AppShellMain() {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <MobileAppHeader />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
        <ErrorBoundary section="el módulo actual">
          <Suspense fallback={<OperationalDetailSkeleton className="p-6" />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  )
}

export function AppShell() {
  return (
    <SidebarLayoutProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-surface-0">
        <Sidebar />
        <AppShellMain />
      </div>
    </SidebarLayoutProvider>
  )
}
