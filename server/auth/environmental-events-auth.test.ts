import { describe, expect, it } from 'vitest'
import {
  OPERATIONAL_ROUTE_REGISTRY,
  registryRoutesForFile,
} from './route-registry.js'

describe('environmental-events route auth registry', () => {
  it('registers the generic events routes as protected', () => {
    const routes = registryRoutesForFile('environmental-events.ts')
    expect(routes.length).toBeGreaterThan(0)
    for (const route of routes) {
      expect(route.status).toBe('protected')
      expect(route.permission).toBe('incidents.view')
      expect(route.authorizer).toBe('sessionOnly')
      expect(route.usesServiceRole).toBe(true)
      expect(route.rateLimit).toBe('default_read')
    }
  })

  it('does not leave the generic events routes incomplete', () => {
    const incomplete = OPERATIONAL_ROUTE_REGISTRY.filter(
      (r) => r.routeFile === 'environmental-events.ts' && r.status === 'incomplete',
    )
    expect(incomplete).toHaveLength(0)
  })

  it('keeps legacy thermal routes registered (no destructive removal)', () => {
    const fires = registryRoutesForFile('fires.ts')
    expect(fires.some((r) => r.path === '/api/environment/fires/*')).toBe(true)
  })
})
