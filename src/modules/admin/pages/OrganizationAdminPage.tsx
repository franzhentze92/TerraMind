import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { authFetch } from '@/core/auth/auth-fetch'
import { OperationalEmptyState } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { useHasPermission } from '@/core/auth/AuthProvider'
import { roleLabel, membershipStatusLabel, humanizeToken } from '@/shared/product-language'

const INVITABLE_ROLES = [
  'viewer',
  'analyst',
  'field_technician',
  'field_supervisor',
  'operations_coordinator',
  'organization_admin',
] as const

function membershipStatusVariant(status: string): 'success' | 'warning' | 'critical' | 'default' {
  if (status === 'active') return 'success'
  if (status === 'invited' || status === 'pending') return 'warning'
  if (status === 'suspended' || status === 'revoked') return 'critical'
  return 'default'
}

interface MemberRow {
  membership_id: string
  email: string
  display_name: string
  status: string
  roles: string[]
}

interface InvitationRow {
  id: string
  email: string
  status: string
  proposed_roles: string[]
  expires_at: string
  accept_url?: string | null
}

export function OrganizationAdminPage() {
  const canInvite = useHasPermission('users.invite')
  const canManage = useHasPermission('memberships.manage')
  const [members, setMembers] = useState<MemberRow[]>([])
  const [invitations, setInvitations] = useState<InvitationRow[]>([])
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('viewer')
  const [inviteMessage, setInviteMessage] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (canManage) {
      const res = await authFetch('/api/admin/organization/members')
      if (res.ok) {
        const data = (await res.json()) as { items: MemberRow[] }
        setMembers(data.items)
      }
    }
    if (canInvite) {
      const res = await authFetch('/api/admin/organization/invitations')
      if (res.ok) {
        const data = (await res.json()) as { items: InvitationRow[] }
        setInvitations(data.items)
      }
    }
    const auditRes = await authFetch('/api/admin/organization/audit')
    if (auditRes.ok) {
      const data = (await auditRes.json()) as { items: Array<Record<string, unknown>> }
      setAudit(data.items)
    }
  }, [canInvite, canManage])

  useEffect(() => {
    void load()
  }, [load])

  async function createInvite(e: React.FormEvent) {
    e.preventDefault()
    const res = await authFetch('/api/admin/organization/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: inviteEmail,
        roles: [inviteRole],
        message: inviteMessage.trim() || undefined,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error ?? 'No se pudo crear la invitación')
      return
    }
    setMessage(data.accept_url ? `Invitación creada. Link: ${data.accept_url}` : 'Invitación creada.')
    setInviteEmail('')
    setInviteMessage('')
    setInviteRole('viewer')
    await load()
  }

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Administración de organización</h1>
        <p className="text-sm text-muted-foreground">Miembros, invitaciones, roles y auditoría.</p>
      </div>

      <nav className="flex flex-wrap gap-3 text-sm">
        <Link to="/admin/organizacion/miembros" className="underline">
          Miembros
        </Link>
        <Link to="/admin/organizacion/invitaciones" className="underline">
          Invitaciones
        </Link>
        <Link to="/admin/organizacion/auditoria" className="underline">
          Auditoría
        </Link>
      </nav>

      {canInvite && (
        <section className="rounded border p-4" id="invite">
          <h2 className="mb-3 font-medium">Invitar usuario</h2>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => void createInvite(e)}>
            <label className="flex flex-col gap-1 text-xs text-text-tertiary">
              Correo
              <input
                className="min-w-[240px] rounded border px-3 py-2 text-sm text-text-primary"
                placeholder="email@organizacion.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                type="email"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-tertiary">
              Rol
              <select
                className="min-w-[200px] rounded border px-3 py-2 text-sm text-text-primary"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-text-tertiary">
              Mensaje (opcional)
              <input
                className="min-w-[240px] rounded border px-3 py-2 text-sm text-text-primary"
                placeholder="Mensaje para la persona invitada"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                type="text"
              />
            </label>
            <button type="submit" className="rounded bg-primary px-4 py-2 text-primary-foreground">
              Invitar
            </button>
          </form>
          {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
        </section>
      )}

      {canManage && (
        <section className="rounded border p-4">
          <h2 className="mb-3 font-medium">Miembros</h2>
          {members.length === 0 ? (
            <OperationalEmptyState
              compact
              title="Esta organización solo tiene un administrador"
              explanation="Invita a colegas para compartir acceso operacional."
              primaryAction={{ label: 'Invitar miembro', href: '#invite' }}
            />
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider text-text-tertiary">
                  <th className="py-2 pr-4 font-medium">Miembro</th>
                  <th className="py-2 pr-4 font-medium">Correo</th>
                  <th className="py-2 pr-4 font-medium">Estado</th>
                  <th className="py-2 pr-4 font-medium">Roles</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.membership_id} className="border-b border-border-subtle/60">
                    <td className="py-2 pr-4 font-medium text-text-primary">
                      {m.display_name || m.email}
                    </td>
                    <td className="py-2 pr-4 text-text-secondary">{m.email}</td>
                    <td className="py-2 pr-4">
                      <Badge variant={membershipStatusVariant(m.status)}>
                        {membershipStatusLabel(m.status)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <div className="flex flex-wrap gap-1">
                        {m.roles.map((r) => (
                          <Badge key={r} variant="default">
                            {roleLabel(r)}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </section>
      )}

      {canInvite && (
        <section className="rounded border p-4">
          <h2 className="mb-3 font-medium">Invitaciones</h2>
          {invitations.length === 0 ? (
            <OperationalEmptyState
              compact
              title="No hay invitaciones pendientes"
              explanation="Crea una invitación para agregar miembros a la organización."
              primaryAction={{ label: 'Crear invitación', href: '#invite' }}
            />
          ) : (
          <ul className="space-y-2 text-sm">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center gap-2 border-b py-2">
                <span className="font-medium text-text-primary">{inv.email}</span>
                <Badge variant={membershipStatusVariant(inv.status)}>
                  {membershipStatusLabel(inv.status)}
                </Badge>
                {inv.proposed_roles.map((r) => (
                  <Badge key={r} variant="default">
                    {roleLabel(r)}
                  </Badge>
                ))}
                <span className="text-text-tertiary">
                  Expira {new Date(inv.expires_at).toLocaleString('es-GT')}
                </span>
              </li>
            ))}
          </ul>
          )}
        </section>
      )}

      <section className="rounded border p-4">
        <h2 className="mb-3 font-medium">Auditoría reciente</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {audit.map((evt, idx) => (
            <li key={idx}>
              {new Date(String(evt.created_at)).toLocaleString('es-GT')} ·{' '}
              {humanizeToken(String(evt.event_type))} · {humanizeToken(String(evt.outcome))}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
