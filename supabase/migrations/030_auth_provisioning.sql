-- 030_auth_provisioning.sql
-- TerraMind — Auth Provisioning & Tenant Administration (8B.7F.3)
-- Additive only. Do NOT apply until 8B.7F.4 activation block.

alter table public.user_profiles
  add column if not exists provisioning_status text not null default 'active'
    check (provisioning_status in ('active', 'awaiting_access', 'suspended'));

alter table public.user_profiles
  add column if not exists last_active_at timestamptz;

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email_normalized text not null,
  display_name text not null default '',
  proposed_roles jsonb not null default '[]'::jsonb,
  token_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked')),
  invited_by_user_id uuid references public.user_profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organization_invitations_pending_email_idx
  on public.organization_invitations (organization_id, email_normalized)
  where status = 'pending';

create index if not exists organization_invitations_token_hash_idx
  on public.organization_invitations (token_hash)
  where status = 'pending';

create table if not exists public.platform_bootstrap_runs (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  organization_id uuid not null references public.organizations (id),
  user_profile_id uuid not null references public.user_profiles (id),
  completed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists platform_bootstrap_runs_singleton_idx
  on public.platform_bootstrap_runs ((true));
