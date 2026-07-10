export type Permission =
  | 'copilot:read'
  | 'copilot:interact'
  | 'territory:read'
  | 'events:read'
  | 'events:manage'
  | 'reports:read'
  | 'reports:generate'
  | 'strategies:read'
  | 'strategies:manage'
  | 'settings:read'
  | 'settings:manage'
  | 'integrations:manage'
  | 'admin:full'

export type Role = 'viewer' | 'analyst' | 'decision-maker' | 'admin'

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ['copilot:read', 'territory:read', 'events:read', 'reports:read'],
  analyst: [
    'copilot:read',
    'copilot:interact',
    'territory:read',
    'events:read',
    'reports:read',
    'reports:generate',
    'strategies:read',
  ],
  'decision-maker': [
    'copilot:read',
    'copilot:interact',
    'territory:read',
    'events:read',
    'events:manage',
    'reports:read',
    'reports:generate',
    'strategies:read',
    'strategies:manage',
    'settings:read',
  ],
  admin: ['admin:full'],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role]
  return perms.includes('admin:full') || perms.includes(permission)
}
