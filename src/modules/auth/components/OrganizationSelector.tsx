import { useAuth } from '@/core/auth/AuthProvider'
import { useAuthStore } from '@/core/auth/auth.store'
import { authFetch } from '@/core/auth/auth-fetch'

export function OrganizationSelector() {
  const { authContext, refreshMe } = useAuth()
  const organizations = useAuthStore((s) => s.organizations)

  if (!authContext || organizations.length <= 1) return null

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Organización</span>
      <select
        className="rounded border bg-background px-2 py-1 text-foreground"
        value={authContext.activeOrganizationId}
        onChange={async (e) => {
          const organizationId = e.target.value
          await authFetch('/api/auth/active-organization', {
            method: 'POST',
            body: JSON.stringify({ organization_id: organizationId }),
          })
          useAuthStore.getState().setPendingSyncWarning(true)
          await refreshMe()
        }}
      >
        {organizations.map((org) => (
          <option key={org.id} value={org.id}>
            {org.name}
          </option>
        ))}
      </select>
    </label>
  )
}
