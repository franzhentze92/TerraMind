/**
 * Machine-readable navigation inventory — Product Consolidation Phase 2.
 * Sidebar, route guards and product-navigation:audit consume this registry.
 */
import type { TerramindPermission, TerramindRole } from '@/core/auth/permissions'

export type NavSectionKey =
  | 'monitoreo'
  | 'inteligencia'
  | 'operaciones'
  | 'campo'
  | 'analisis'
  | 'administracion'

export type RouteNavLevel = 'primary' | 'secondary' | 'hidden' | 'alias'
export type RouteStatus = 'active' | 'hidden' | 'alias' | 'deprecated'

export interface RouteRegistryEntry {
  path: string
  title: string
  section: NavSectionKey
  permission?: TerramindPermission
  /** Visible when the user holds any of these permissions. */
  anyPermission?: TerramindPermission[]
  navLevel: RouteNavLevel
  status: RouteStatus
  aliasOf?: string
  parentPath?: string
  nextLogicalRoute?: string
  routeGuard?: TerramindPermission
  /** Hide from primary nav for these roles even when permission matches. */
  hiddenForRoles?: TerramindRole[]
  /** Show only for these roles (field-tech reduced experience). */
  onlyForRoles?: TerramindRole[]
}

export const NAV_SECTION_LABELS: Record<NavSectionKey, string> = {
  monitoreo: 'Monitoreo',
  inteligencia: 'Inteligencia',
  operaciones: 'Operaciones',
  campo: 'Campo',
  analisis: 'Análisis',
  administracion: 'Administración',
}

/** Every frontend route the product exposes (including aliases and Campo sub-routes). */
export const ROUTE_REGISTRY: RouteRegistryEntry[] = [
  // Monitoreo
  {
    path: '/situacion',
    title: 'Situación Nacional',
    section: 'monitoreo',
    anyPermission: ['findings.view', 'incidents.view'],
    navLevel: 'primary',
    status: 'active',
    nextLogicalRoute: '/hallazgos',
    routeGuard: 'findings.view',
  },
  {
    path: '/situacion-nacional',
    title: 'Situación Nacional',
    section: 'monitoreo',
    navLevel: 'alias',
    status: 'alias',
    aliasOf: '/situacion',
    routeGuard: 'findings.view',
  },
  {
    path: '/incendios',
    title: 'Actividad térmica',
    section: 'monitoreo',
    anyPermission: ['incidents.view', 'findings.view'],
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'incidents.view',
  },
  {
    path: '/biodiversidad',
    title: 'Biodiversidad',
    section: 'monitoreo',
    permission: 'findings.view',
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'findings.view',
  },
  {
    path: '/territorio',
    title: 'Territorio',
    section: 'monitoreo',
    permission: 'findings.view',
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'findings.view',
  },
  // Inteligencia
  {
    path: '/hallazgos',
    title: 'Hallazgos',
    section: 'inteligencia',
    permission: 'findings.view',
    navLevel: 'primary',
    status: 'active',
    nextLogicalRoute: '/prioridades',
    routeGuard: 'findings.view',
  },
  {
    path: '/prioridades',
    title: 'Prioridades',
    section: 'inteligencia',
    permission: 'priorities.view',
    navLevel: 'primary',
    status: 'active',
    nextLogicalRoute: '/incidentes',
    routeGuard: 'priorities.view',
  },
  {
    path: '/incidentes',
    title: 'Incidentes',
    section: 'inteligencia',
    permission: 'incidents.view',
    navLevel: 'primary',
    status: 'active',
    nextLogicalRoute: '/verificaciones',
    routeGuard: 'incidents.view',
  },
  // Operaciones
  {
    path: '/verificaciones',
    title: 'Verificaciones',
    section: 'operaciones',
    permission: 'verification_plans.view',
    navLevel: 'primary',
    status: 'active',
    nextLogicalRoute: '/misiones',
    routeGuard: 'verification_plans.view',
  },
  {
    path: '/misiones',
    title: 'Misiones',
    section: 'operaciones',
    permission: 'missions.view',
    navLevel: 'primary',
    status: 'active',
    nextLogicalRoute: '/respuesta',
    routeGuard: 'missions.view',
  },
  {
    path: '/misiones/asignaciones',
    title: 'Asignaciones',
    section: 'operaciones',
    permission: 'missions.assign',
    navLevel: 'secondary',
    status: 'active',
    parentPath: '/misiones',
    routeGuard: 'missions.assign',
  },
  {
    path: '/operaciones/asignaciones',
    title: 'Asignaciones',
    section: 'operaciones',
    navLevel: 'alias',
    status: 'alias',
    aliasOf: '/misiones/asignaciones',
    routeGuard: 'missions.assign',
  },
  {
    path: '/respuesta',
    title: 'Respuesta',
    section: 'operaciones',
    permission: 'responses.view',
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'responses.view',
  },
  // Campo
  {
    path: '/campo',
    title: 'Mi trabajo',
    section: 'campo',
    anyPermission: ['offline_packages.download', 'field_sync.execute', 'missions.accept'],
    navLevel: 'primary',
    status: 'active',
    hiddenForRoles: ['viewer', 'analyst'],
    routeGuard: 'missions.view',
  },
  {
    path: '/campo/misiones',
    title: 'Misiones',
    section: 'campo',
    navLevel: 'secondary',
    status: 'active',
    parentPath: '/campo',
    routeGuard: 'missions.view',
  },
  {
    path: '/campo/paquetes',
    title: 'Paquetes',
    section: 'campo',
    navLevel: 'secondary',
    status: 'active',
    parentPath: '/campo',
    routeGuard: 'offline_packages.download',
  },
  {
    path: '/campo/evidencia-pendiente',
    title: 'Evidencia',
    section: 'campo',
    navLevel: 'secondary',
    status: 'active',
    parentPath: '/campo',
    routeGuard: 'evidence.submit',
  },
  {
    path: '/campo/sincronizacion',
    title: 'Sincronización',
    section: 'campo',
    navLevel: 'secondary',
    status: 'active',
    parentPath: '/campo',
    routeGuard: 'field_sync.execute',
  },
  {
    path: '/campo/conflictos',
    title: 'Conflictos',
    section: 'campo',
    navLevel: 'secondary',
    status: 'active',
    parentPath: '/campo',
    routeGuard: 'field_sync.resolve_conflict',
  },
  // Análisis
  {
    path: '/tendencias',
    title: 'Tendencias',
    section: 'analisis',
    permission: 'findings.view',
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'findings.view',
  },
  {
    path: '/informes',
    title: 'Informes',
    section: 'analisis',
    permission: 'findings.view',
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'findings.view',
  },
  {
    path: '/copilot',
    title: 'Copilot',
    section: 'analisis',
    permission: 'findings.view',
    navLevel: 'primary',
    status: 'active',
    hiddenForRoles: ['viewer', 'field_technician'],
    routeGuard: 'findings.view',
  },
  // Administración
  {
    path: '/admin/organizacion',
    title: 'Organización',
    section: 'administracion',
    permission: 'organization.settings',
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'organization.settings',
  },
  {
    path: '/fuentes',
    title: 'Integraciones',
    section: 'administracion',
    permission: 'organization.settings',
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'organization.settings',
  },
  {
    path: '/administracion',
    title: 'Sistema',
    section: 'administracion',
    permission: 'organization.settings',
    navLevel: 'primary',
    status: 'active',
    routeGuard: 'organization.settings',
  },
  // Hidden / legacy (no primary sidebar)
  {
    path: '/conocimiento',
    title: 'Conocimiento',
    section: 'administracion',
    navLevel: 'hidden',
    status: 'deprecated',
    routeGuard: 'findings.view',
  },
  {
    path: '/estrategias',
    title: 'Estrategias',
    section: 'analisis',
    navLevel: 'hidden',
    status: 'hidden',
    routeGuard: 'findings.view',
  },
]

export const CAMPO_SECONDARY_NAV = [
  { path: '/campo', label: 'Inicio', end: true },
  { path: '/campo/misiones', label: 'Misiones' },
  { path: '/campo/paquetes', label: 'Paquetes' },
  { path: '/campo/evidencia-pendiente', label: 'Evidencia' },
  { path: '/campo/sincronizacion', label: 'Sincronización' },
  { path: '/campo/conflictos', label: 'Conflictos' },
] as const

export function getRouteEntry(path: string): RouteRegistryEntry | undefined {
  return ROUTE_REGISTRY.find((r) => r.path === path)
}

export function getPrimaryNavForSection(section: NavSectionKey): RouteRegistryEntry[] {
  return ROUTE_REGISTRY.filter(
    (r) => r.section === section && r.navLevel === 'primary' && r.status === 'active',
  )
}

export function getAliases(): RouteRegistryEntry[] {
  return ROUTE_REGISTRY.filter((r) => r.status === 'alias')
}
