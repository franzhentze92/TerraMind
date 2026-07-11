-- 031_response_orchestration.sql
-- TerraMind — Decision & Response Orchestration Engine (8C.1)
-- NOT applied automatically — review before remote activation.

create table if not exists public.response_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  incident_version integer not null default 1,
  verification_resolution_id uuid references public.verification_need_resolutions (id) on delete set null,
  response_model_id text not null default 'fire-response-orchestration',
  response_model_version text not null default '1.0.0',
  recommended_response_level text not null,
  urgency text not null,
  rationale_codes jsonb not null default '[]'::jsonb,
  blocking_uncertainties jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  prohibited_actions jsonb not null default '[]'::jsonb,
  required_authority jsonb not null default '{}'::jsonb,
  closure_recommendation text not null,
  reassessment_at timestamptz,
  input_snapshot jsonb not null default '{}'::jsonb,
  input_signature text not null,
  output_signature text not null,
  status text not null default 'recommended'
    check (status in (
      'waiting_for_reevaluation', 'ready_for_assessment', 'blocked_inconsistent_snapshot',
      'recommended', 'superseded'
    )),
  idempotency_key text not null,
  is_active boolean not null default true,
  supersedes_assessment_id uuid references public.response_assessments (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists response_assessments_idempotency_idx
  on public.response_assessments (organization_id, idempotency_key);

create unique index if not exists response_assessments_active_idx
  on public.response_assessments (incident_id, response_model_version)
  where is_active = true;

create index if not exists response_assessments_org_incident_idx
  on public.response_assessments (organization_id, incident_id, created_at desc);

create table if not exists public.decision_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  response_assessment_id uuid not null references public.response_assessments (id) on delete cascade,
  decision text not null,
  decision_type text not null check (decision_type in ('system_recommendation', 'human_decision')),
  decision_status text not null check (decision_status in (
    'recommended', 'pending_review', 'approved', 'modified', 'rejected',
    'superseded', 'executing', 'completed', 'cancelled'
  )),
  original_recommendation jsonb not null default '{}'::jsonb,
  decided_by uuid references public.user_profiles (id),
  authority_context jsonb not null default '{}'::jsonb,
  rationale text not null default '',
  limitations jsonb not null default '[]'::jsonb,
  decided_at timestamptz,
  supersedes_decision_id uuid references public.decision_records (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decision_records_incident_idx
  on public.decision_records (incident_id, created_at desc);

create table if not exists public.response_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  decision_id uuid not null references public.decision_records (id) on delete cascade,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  action_type text not null,
  status text not null default 'draft' check (status in (
    'draft', 'pending_approval', 'approved', 'executing', 'completed',
    'failed', 'cancelled', 'superseded'
  )),
  owner_type text not null check (owner_type in ('system', 'user')),
  owner_id uuid references public.user_profiles (id),
  priority integer not null default 50,
  due_at timestamptz,
  execution_mode text not null check (execution_mode in ('manual', 'auto_draft', 'auto_execute')),
  requires_approval boolean not null default true,
  external_reference text,
  completion_evidence_reference text,
  rationale_code text,
  supersedes_action_id uuid references public.response_actions (id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists response_actions_decision_idx
  on public.response_actions (decision_id, created_at desc);

create table if not exists public.notification_directives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  decision_id uuid not null references public.decision_records (id) on delete cascade,
  incident_id uuid not null references public.incidents (id) on delete cascade,
  audience_type text not null,
  channel_type text not null,
  urgency text not null,
  message_template_id text not null,
  approval_required boolean not null default true,
  status text not null default 'draft' check (status in (
    'draft', 'pending_approval', 'approved', 'sent', 'cancelled'
  )),
  draft_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_directives_decision_idx
  on public.notification_directives (decision_id, created_at desc);

create table if not exists public.response_orchestration_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  assessment_id uuid references public.response_assessments (id) on delete set null,
  decision_id uuid references public.decision_records (id) on delete set null,
  event_type text not null,
  actor_type text not null check (actor_type in ('system', 'user')),
  actor_id uuid references public.user_profiles (id),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists response_orchestration_events_incident_idx
  on public.response_orchestration_events (incident_id, created_at desc);

create table if not exists public.response_assessment_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  incident_id uuid not null references public.incidents (id) on delete cascade,
  verification_resolution_id uuid references public.verification_need_resolutions (id) on delete set null,
  status text not null default 'pending' check (status in (
    'pending', 'waiting_dependencies', 'ready', 'running', 'completed',
    'blocked_inconsistent_snapshot', 'failed_retryable', 'failed_terminal'
  )),
  dependencies jsonb not null default '[]'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  error_code text,
  next_retry_at timestamptz,
  input_signature text,
  result_assessment_id uuid references public.response_assessments (id) on delete set null,
  idempotency_key text not null,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists response_assessment_jobs_idempotency_idx
  on public.response_assessment_jobs (organization_id, idempotency_key);

create index if not exists response_assessment_jobs_status_idx
  on public.response_assessment_jobs (status, next_retry_at, created_at);

-- ---------------------------------------------------------------------------
-- Permissions (8C.1.2)
-- ---------------------------------------------------------------------------

insert into public.permissions (id, category, label) values
  ('responses.view', 'response', 'View response orchestration'),
  ('responses.assess', 'response', 'Assess incident response'),
  ('responses.decide', 'response', 'Record human response decisions'),
  ('responses.approve', 'response', 'Approve response decisions'),
  ('responses.modify', 'response', 'Modify response decisions'),
  ('responses.reject', 'response', 'Reject response recommendations'),
  ('response_actions.create', 'response', 'Create response actions'),
  ('response_actions.execute', 'response', 'Execute response actions'),
  ('response_actions.complete', 'response', 'Complete response actions'),
  ('notifications.prepare', 'response', 'Prepare notification drafts'),
  ('notifications.approve', 'response', 'Approve notification drafts'),
  ('incident_closure.recommend', 'response', 'Recommend incident closure')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'operations_coordinator', p.id from public.permissions p
where p.id in (
  'responses.view', 'responses.assess', 'responses.decide', 'responses.approve',
  'responses.modify', 'responses.reject', 'response_actions.create', 'response_actions.execute',
  'response_actions.complete', 'notifications.prepare', 'notifications.approve',
  'incident_closure.recommend'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'organization_admin', p.id from public.permissions p
where p.id in (
  'responses.view', 'responses.assess', 'responses.decide', 'responses.approve',
  'responses.modify', 'responses.reject', 'response_actions.create', 'response_actions.execute',
  'response_actions.complete', 'notifications.prepare', 'notifications.approve',
  'incident_closure.recommend'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'field_supervisor', p.id from public.permissions p
where p.id in (
  'responses.view', 'responses.decide', 'response_actions.create', 'response_actions.execute',
  'response_actions.complete', 'notifications.prepare'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'analyst', p.id from public.permissions p
where p.id in (
  'responses.view', 'responses.assess', 'responses.decide', 'responses.modify',
  'response_actions.create', 'incident_closure.recommend'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'viewer', p.id from public.permissions p
where p.id in ('responses.view')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'platform_admin', p.id from public.permissions p
where p.category = 'response'
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.response_assessments enable row level security;
alter table public.decision_records enable row level security;
alter table public.response_actions enable row level security;
alter table public.notification_directives enable row level security;
alter table public.response_orchestration_events enable row level security;
alter table public.response_assessment_jobs enable row level security;

create policy response_assessments_org_select on public.response_assessments
  for select using (
    organization_id in (
      select om.organization_id from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );

create policy decision_records_org_select on public.decision_records
  for select using (
    organization_id in (
      select om.organization_id from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );

create policy response_actions_org_select on public.response_actions
  for select using (
    organization_id in (
      select om.organization_id from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );

create policy notification_directives_org_select on public.notification_directives
  for select using (
    organization_id in (
      select om.organization_id from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );

create policy response_orchestration_events_org_select on public.response_orchestration_events
  for select using (
    organization_id in (
      select om.organization_id from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );

create policy response_assessment_jobs_org_select on public.response_assessment_jobs
  for select using (
    organization_id in (
      select om.organization_id from public.organization_memberships om
      join public.user_profiles up on up.id = om.user_id
      where up.auth_user_id = auth.uid() and om.status = 'active'
    )
  );
