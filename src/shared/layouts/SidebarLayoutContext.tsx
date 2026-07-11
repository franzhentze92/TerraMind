import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

interface SidebarLayoutContextValue {
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
  toggleMobile: () => void
  isMobile: boolean
  isTablet: boolean
}

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(null)

function readViewport() {
  if (typeof window === 'undefined') return { mobile: false, tablet: false }
  const w = window.innerWidth
  return { mobile: w < 768, tablet: w >= 768 && w < 1024 }
}

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [viewport, setViewport] = useState(readViewport)

  useEffect(() => {
    const onResize = () => setViewport(readViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen || !viewport.mobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen, viewport.mobile])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), [])

  const value = useMemo(
    () => ({
      mobileOpen,
      openMobile,
      closeMobile,
      toggleMobile,
      isMobile: viewport.mobile,
      isTablet: viewport.tablet,
    }),
    [mobileOpen, openMobile, closeMobile, toggleMobile, viewport.mobile, viewport.tablet],
  )

  return <SidebarLayoutContext.Provider value={value}>{children}</SidebarLayoutContext.Provider>
}

export function useSidebarLayout() {
  const ctx = useContext(SidebarLayoutContext)
  if (!ctx) throw new Error('useSidebarLayout must be used within SidebarLayoutProvider')
  return ctx
}
