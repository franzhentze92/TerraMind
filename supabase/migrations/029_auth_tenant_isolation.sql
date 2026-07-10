-- 029_auth_tenant_isolation.sql
-- TerraMind — Authentication, Authorization & Tenant Isolation (8B.7F)
-- Additive only. Do NOT apply until staging environment is confirmed.

-- ---------------------------------------------------------------------------
-- Core tenant & identity
-- ---------------------------------------------------------------------------

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'suspended')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null,
  display_name text not null default '',
  active_organization_id uuid references public.organizations (id),
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_profiles_auth_user_idx
  on public.user_profiles (auth_user_id);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  status text not null default 'invited'
    check (status in ('invited', 'active', 'suspended', 'revoked')),
  invited_at timestamptz,
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index if not exists organization_memberships_user_idx
  on public.organization_memberships (user_id, status);

create table if not exists public.roles (
  id text primary key,
  label text not null,
  scope text not null check (scope in ('platform', 'organization'))
);

create table if not exists public.permissions (
  id text primary key,
  category text not null,
  label text not null default ''
);

create table if not exists public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.membership_roles (
  membership_id uuid not null references public.organization_memberships (id) on delete cascade,
  role_id text not null references public.roles (id) on delete cascade,
  primary key (membership_id, role_id)
);

-- ---------------------------------------------------------------------------
-- Audit (no tokens / secrets)
-- ---------------------------------------------------------------------------

create table if not exists public.auth_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  auth_user_id uuid,
  user_id uuid references public.user_profiles (id),
  organization_id uuid references public.organizations (id),
  resource_type text,
  resource_id text,
  outcome text not null check (outcome in ('allowed', 'denied', 'error')),
  metadata jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists auth_audit_events_org_idx
  on public.auth_audit_events (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Seed roles & permissions
-- ---------------------------------------------------------------------------

insert into public.roles (id, label, scope) values
  ('platform_admin', 'Platform Admin', 'platform'),
  ('organization_admin', 'Organization Admin', 'organization'),
  ('operations_coordinator', 'Operations Coordinator', 'organization'),
  ('field_supervisor', 'Field Supervisor', 'organization'),
  ('field_technician', 'Field Technician', 'organization'),
  ('analyst', 'Analyst', 'organization'),
  ('viewer', 'Viewer', 'organization')
on conflict (id) do nothing;

insert into public.permissions (id, category, label) values
  ('incidents.view', 'intelligence', 'View incidents'),
  ('findings.view', 'intelligence', 'View findings'),
  ('priorities.view', 'intelligence', 'View priorities'),
  ('verification_plans.view', 'intelligence', 'View verification plans'),
  ('missions.view', 'missions', 'View missions'),
  ('missions.assign', 'missions', 'Assign missions'),
  ('missions.accept', 'missions', 'Accept missions'),
  ('missions.decline', 'missions', 'Decline missions'),
  ('missions.start', 'missions', 'Start missions'),
  ('missions.block', 'missions', 'Block missions'),
  ('missions.complete', 'missions', 'Complete missions'),
  ('missions.cancel', 'missions', 'Cancel missions'),
  ('evidence.submit', 'evidence', 'Submit evidence'),
  ('evidence.view', 'evidence', 'View evidence'),
  ('evidence.withdraw', 'evidence', 'Withdraw evidence'),
  ('evidence.validate', 'evidence', 'Validate evidence'),
  ('evidence.revalidate', 'evidence', 'Revalidate evidence'),
  ('offline_packages.generate', 'offline', 'Generate offline packages'),
  ('offline_packages.download', 'offline', 'Download offline packages'),
  ('offline_packages.revoke', 'offline', 'Revoke offline packages'),
  ('field_sync.execute', 'sync', 'Execute field sync'),
  ('field_sync.retry', 'sync', 'Retry field sync'),
  ('field_sync.resolve_conflict', 'sync', 'Resolve sync conflicts'),
  ('users.invite', 'admin', 'Invite users'),
  ('memberships.manage', 'admin', 'Manage memberships'),
  ('roles.manage', 'admin', 'Manage roles'),
  ('organization.settings', 'admin', 'Organization settings')
on conflict (id) do nothing;

-- field_technician
insert into public.role_permissions (role_id, permission_id)
select 'field_technician', p.id from public.permissions p
where p.id in (
  'missions.view', 'missions.accept', 'missions.decline', 'missions.start', 'missions.complete',
  'evidence.submit', 'evidence.view',
  'offline_packages.download',
  'field_sync.execute', 'field_sync.retry'
)
on conflict do nothing;

-- field_supervisor (+ assign)
insert into public.role_permissions (role_id, permission_id)
select 'field_supervisor', p.id from public.permissions p
where p.id in (
  'missions.view', 'missions.assign', 'missions.accept', 'missions.start', 'missions.block', 'missions.complete',
  'evidence.view', 'evidence.submit',
  'offline_packages.download', 'offline_packages.revoke',
  'field_sync.execute', 'field_sync.retry', 'field_sync.resolve_conflict'
)
on conflict do nothing;

-- operations_coordinator
insert into public.role_permissions (role_id, permission_id)
select 'operations_coordinator', p.id from public.permissions p
where p.id in (
  'incidents.view', 'verification_plans.view', 'findings.view', 'priorities.view',
  'missions.view', 'missions.assign', 'missions.cancel', 'missions.block', 'missions.complete',
  'evidence.view', 'evidence.submit', 'evidence.validate',
  'offline_packages.generate', 'offline_packages.download', 'offline_packages.revoke',
  'field_sync.execute', 'field_sync.retry', 'field_sync.resolve_conflict'
)
on conflict do nothing;

-- analyst
insert into public.role_permissions (role_id, permission_id)
select 'analyst', p.id from public.permissions p
where p.id in (
  'incidents.view', 'findings.view', 'priorities.view', 'verification_plans.view',
  'missions.view', 'evidence.view', 'evidence.validate', 'evidence.revalidate'
)
on conflict do nothing;

-- organization_admin
insert into public.role_permissions (role_id, permission_id)
select 'organization_admin', p.id from public.permissions p
where p.category in ('admin', 'missions', 'evidence', 'offline', 'sync', 'intelligence')
on conflict do nothing;

-- viewer
insert into public.role_permissions (role_id, permission_id)
select 'viewer', p.id from public.permissions p
where p.id in (
  'incidents.view', 'findings.view', 'priorities.view', 'verification_plans.view', 'missions.view', 'evidence.view'
)
on conflict do nothing;

-- platform_admin — all permissions
insert into public.role_permissions (role_id, permission_id)
select 'platform_admin', p.id from public.permissions p
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Link operational assignees to internal users
-- ---------------------------------------------------------------------------

alter table public.operational_assignees
  add column if not exists user_profile_id uuid references public.user_profiles (id);

-- ---------------------------------------------------------------------------
-- organization_id on operational resources
-- ---------------------------------------------------------------------------

alter table public.incidents
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.verification_plans
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.missions
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.evidence_submissions
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.offline_mission_packages
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.evidence_upload_sessions
  add column if not exists organization_id uuid references public.organizations (id);

alter table public.evidence_bundle_sync_registrations
  add column if not exists organization_id uuid references public.organizations (id);

create index if not exists incidents_organization_idx on public.incidents (organization_id);
create index if not exists verification_plans_organization_idx on public.verification_plans (organization_id);
create index if not exists missions_organization_idx on public.missions (organization_id);
create index if not exists evidence_submissions_organization_idx on public.evidence_submissions (organization_id);
create index if not exists offline_mission_packages_organization_idx on public.offline_mission_packages (organization_id);

-- ---------------------------------------------------------------------------
-- RLS — defense in depth (service role bypasses; user-scoped reads when used)
-- ---------------------------------------------------------------------------

alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.membership_roles enable row level security;
alter table public.auth_audit_events enable row level security;

-- Users read own profile
create policy user_profiles_self_select on public.user_profiles
  for select using (auth.uid() = auth_user_id);

-- Users read own memberships
create policy organization_memberships_self_select on public.organization_memberships
  for select using (
    user_id in (select id from public.user_profiles where auth_user_id = auth.uid())
  );

-- Users read orgs they belong to
create policy organizations_member_select on public.organizations
  for select using (
    id in (
      select om.organization_id
      from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );

-- Missions scoped to active org membership
create policy missions_org_member_select on public.missions
  for select using (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );

-- Incidents scoped similarly
create policy incidents_org_member_select on public.incidents
  for select using (
    organization_id is null
    or organization_id in (
      select om.organization_id
      from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );

-- Backend-only tables: no public policies (028 sync tables remain backend-only)

comment on table public.auth_audit_events is '8B.7F — access audit; never store tokens or secrets';
