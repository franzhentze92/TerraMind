import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { authFetch } from '@/core/auth/auth-fetch'
import { useHasPermission } from '@/core/auth/AuthProvider'

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
      body: JSON.stringify({ email: inviteEmail, roles: ['viewer'] }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error ?? 'No se pudo crear la invitación')
      return
    }
    setMessage(data.accept_url ? `Invitación creada. Link: ${data.accept_url}` : 'Invitación creada.')
    setInviteEmail('')
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
        <section className="rounded border p-4">
          <h2 className="mb-3 font-medium">Invitar usuario</h2>
          <form className="flex flex-wrap gap-2" onSubmit={(e) => void createInvite(e)}>
            <input
              className="min-w-[240px] rounded border px-3 py-2"
              placeholder="email@organizacion.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
              type="email"
            />
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
          <ul className="space-y-2 text-sm">
            {members.map((m) => (
              <li key={m.membership_id} className="flex flex-wrap items-center gap-2 border-b py-2">
                <span className="font-medium">{m.display_name || m.email}</span>
                <span className="text-muted-foreground">{m.status}</span>
                <span>{m.roles.join(', ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {canInvite && (
        <section className="rounded border p-4">
          <h2 className="mb-3 font-medium">Invitaciones</h2>
          <ul className="space-y-2 text-sm">
            {invitations.map((inv) => (
              <li key={inv.id} className="border-b py-2">
                {inv.email} — {inv.status} — expira {new Date(inv.expires_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded border p-4">
        <h2 className="mb-3 font-medium">Auditoría reciente</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {audit.map((evt, idx) => (
            <li key={idx}>
              {String(evt.created_at)} · {String(evt.event_type)} · {String(evt.outcome)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
