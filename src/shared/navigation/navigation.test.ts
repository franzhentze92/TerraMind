import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { RequestAuthContext } from '@/core/auth/permissions'
import { ROLE_PERMISSION_MAP } from '../../../server/auth/role-permissions'
import {
  CAMPO_SECONDARY_NAV,
  getAliases,
  getPrimaryNavForSection,
  ROUTE_REGISTRY,
} from './navigation-registry'
import { canSeeNavItem, isFieldTechnicianOnly, isViewerOnly } from './role-navigation'

function ctx(roles: RequestAuthContext['roles']): RequestAuthContext {
  const permissions = roles.flatMap((r) => ROLE_PERMISSION_MAP[r] ?? [])
  return {
    authUserId: 'u',
    userId: 'u',
    activeOrganizationId: 'org',
    membershipId: 'm',
    roles,
    permissions: [...new Set(permissions)],
    isPlatformAdmin: roles.includes('platform_admin'),
  }
}

describe('navigation registry', () => {
  it('has exactly one primary Campo entry', () => {
    const campoPrimary = getPrimaryNavForSection('campo')
    expect(campoPrimary).toHaveLength(1)
    expect(campoPrimary[0].path).toBe('/campo')
    expect(campoPrimary[0].title).toBe('Mi trabajo')
  })

  it('does not expose Asignaciones as primary sidebar item', () => {
    const primary = ['inteligencia', 'operaciones'].flatMap((s) =>
      getPrimaryNavForSection(s as 'inteligencia'),
    )
    expect(primary.some((p) => p.path.includes('asignaciones'))).toBe(false)
  })

  it('documents aliases for legacy paths', () => {
    const aliases = getAliases()
    expect(aliases.some((a) => a.path === '/operaciones/asignaciones')).toBe(true)
    expect(aliases.some((a) => a.path === '/situacion-nacional')).toBe(true)
  })

  it('Campo secondary nav has six sections', () => {
    expect(CAMPO_SECONDARY_NAV).toHaveLength(6)
    expect(CAMPO_SECONDARY_NAV.map((n) => n.label)).toContain('Evidencia')
  })
})

describe('role visibility', () => {
  it('viewer does not see administración or campo', () => {
    const viewer = ctx(['viewer'])
    expect(isViewerOnly(viewer)).toBe(true)
    const admin = getPrimaryNavForSection('administracion')
    expect(admin.every((item) => canSeeNavItem(item, viewer))).toBe(false)
    expect(canSeeNavItem(getPrimaryNavForSection('campo')[0], viewer)).toBe(false)
  })

  it('field technician only sees campo primary nav', () => {
    const tech = ctx(['field_technician'])
    expect(isFieldTechnicianOnly(tech)).toBe(true)
    expect(canSeeNavItem(getPrimaryNavForSection('campo')[0], tech)).toBe(true)
    expect(canSeeNavItem(getPrimaryNavForSection('inteligencia')[0], tech)).toBe(false)
  })

  it('analyst does not see administración', () => {
    const analyst = ctx(['analyst'])
    const admin = getPrimaryNavForSection('administracion')
    expect(admin.every((item) => canSeeNavItem(item, analyst))).toBe(false)
  })

  it('organization admin sees administración', () => {
    const admin = ctx(['organization_admin'])
    expect(canSeeNavItem(getPrimaryNavForSection('administracion')[0], admin)).toBe(true)
  })

  it('platform admin sees all primary sections', () => {
    const pa = ctx(['platform_admin'])
    const sections = ['monitoreo', 'inteligencia', 'operaciones', 'campo', 'analisis', 'administracion'] as const
    for (const s of sections) {
      const items = getPrimaryNavForSection(s)
      if (items.length > 0) {
        expect(items.some((item) => canSeeNavItem(item, pa))).toBe(true)
      }
    }
  })
})

describe('router aliases', () => {
  it('redirects /operaciones/asignaciones to /misiones/asignaciones', async () => {
    const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
    expect(routerSource).toContain("path: 'operaciones/asignaciones'")
    expect(routerSource).toContain('<Navigate to="/misiones/asignaciones" replace />')
  })

  it('preserves situacion-nacional alias', async () => {
    const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
    expect(routerSource).toContain("{ path: 'situacion-nacional'")
    expect(routerSource).toContain('NationalSituationPage')
  })
})

describe('route protection', () => {
  it('wraps operational routes with PermissionRoute', () => {
    const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
    expect(routerSource).toContain("guard('missions.view'")
    expect(routerSource).toContain("guard('incidents.view'")
    expect(routerSource).toContain("guard('responses.view'")
    expect(routerSource).toContain("guard('organization.settings'")
  })

  it('every active registry route with routeGuard appears in router', () => {
    const routerSource = readFileSync(resolve(process.cwd(), 'src/app/router.tsx'), 'utf8')
    const guarded = ROUTE_REGISTRY.filter((r) => r.routeGuard && r.status === 'active')
    for (const route of guarded) {
      const pathLiteral = route.path.replace(/^\//, '')
      const topSegment = pathLiteral.split('/')[0]
      expect(
        routerSource.includes(`'${pathLiteral}'`) || routerSource.includes(`'${topSegment}'`),
        route.path,
      ).toBe(true)
    }
  })
})
