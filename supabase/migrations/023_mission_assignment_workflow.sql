-- 023_mission_assignment_workflow.sql
-- TerraMind — Mission Assignment & Operational Workflow (8B.3)

alter table public.missions drop constraint if exists missions_status_check;
alter table public.missions add constraint missions_status_check
  check (status in (
    'draft', 'ready', 'approved', 'assigned', 'in_progress', 'blocked',
    'completed', 'inconclusive', 'cancelled', 'expired', 'failed'
  ));

create table if not exists public.operational_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization_id text not null,
  coverage_zones jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  allowed_mission_types jsonb not null default '[]'::jsonb,
  max_active_missions integer not null default 5 check (max_active_missions > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operational_assignees (
  id text primary key,
  assignee_type text not null check (assignee_type in ('user', 'team', 'organization', 'external_actor')),
  display_name text not null,
  organization_id text,
  coverage_zones jsonb not null default '[]'::jsonb,
  capabilities jsonb not null default '[]'::jsonb,
  allowed_mission_types jsonb not null default '[]'::jsonb,
  max_active_missions integer not null default 3 check (max_active_missions > 0),
  is_available boolean not null default true,
  is_active boolean not null default true,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.operational_teams (id) on delete cascade,
  assignee_id text not null references public.operational_assignees (id),
  role text not null default 'member',
  created_at timestamptz not null default now()
);

create unique index if not exists team_memberships_unique_idx
  on public.team_memberships (team_id, assignee_id);

create table if not exists public.mission_assignments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  assignee_type text not null check (assignee_type in ('user', 'team', 'organization', 'external_actor')),
  assignee_id text not null,
  organization_id text,
  status text not null
    check (status in ('proposed', 'assigned', 'accepted', 'declined', 'active', 'released', 'completed', 'cancelled')),
  assigned_at timestamptz,
  accepted_at timestamptz,
  declined_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  assignment_reason text not null default '',
  decline_reason text,
  reassignment_reason text,
  block_reason text,
  assigned_by_type text not null default 'system' check (assigned_by_type in ('system', 'user')),
  assigned_by_id text,
  context_snapshot jsonb not null default '{}'::jsonb,
  compatibility_snapshot jsonb not null default '{}'::jsonb,
  idempotency_key text,
  workflow_version text not null default '1.0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mission_assignments_active_unique_idx
  on public.mission_assignments (mission_id)
  where status in ('proposed', 'assigned', 'accepted', 'active');

create unique index if not exists mission_assignments_idempotency_idx
  on public.mission_assignments (mission_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists mission_assignments_assignee_idx
  on public.mission_assignments (assignee_type, assignee_id, status);

create table if not exists public.mission_assignment_history (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  assignment_id uuid references public.mission_assignments (id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  reason text not null default '',
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  workflow_version text not null default '1.0.0',
  created_at timestamptz not null default now()
);

create index if not exists mission_assignment_history_mission_idx
  on public.mission_assignment_history (mission_id, created_at desc);

create table if not exists public.mission_workflow_transitions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  assignment_id uuid references public.mission_assignments (id) on delete set null,
  action text not null,
  mission_from_status text,
  mission_to_status text,
  assignment_from_status text,
  assignment_to_status text,
  reason text not null,
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_id text,
  payload jsonb not null default '{}'::jsonb,
  workflow_version text not null default '1.0.0',
  transitioned_at timestamptz not null default now()
);

create index if not exists mission_workflow_transitions_mission_idx
  on public.mission_workflow_transitions (mission_id, transitioned_at desc);

create table if not exists public.mission_assignment_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null,
  assignment_id uuid,
  action text not null,
  idempotency_key text,
  decision text not null,
  warnings jsonb not null default '[]'::jsonb,
  evaluated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create unique index if not exists mission_assignment_eval_idempotency_idx
  on public.mission_assignment_evaluation_runs (mission_id, action, idempotency_key)
  where idempotency_key is not null;

alter table public.operational_teams enable row level security;
alter table public.operational_assignees enable row level security;
alter table public.team_memberships enable row level security;
alter table public.mission_assignments enable row level security;
alter table public.mission_assignment_history enable row level security;
alter table public.mission_workflow_transitions enable row level security;
alter table public.mission_assignment_evaluation_runs enable row level security;
