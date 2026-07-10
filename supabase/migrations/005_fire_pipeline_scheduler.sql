-- Commit 6: pipeline scheduler audit + advisory locks + status refresh metrics

create table if not exists public.fire_pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null
    check (trigger_type in ('scheduled', 'manual', 'startup', 'retry')),
  status text not null
    check (status in ('running', 'success', 'partial', 'failed', 'skipped')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms integer,
  host_identifier text,
  lock_key text not null default 'terramind_fire_pipeline',
  ingestion_run_id uuid references public.fire_ingestion_runs(id) on delete set null,
  stages jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  error_message text,
  retry_of uuid references public.fire_pipeline_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists fire_pipeline_runs_started_at_desc_idx
  on public.fire_pipeline_runs (started_at desc);

create index if not exists fire_pipeline_runs_status_started_at_desc_idx
  on public.fire_pipeline_runs (status, started_at desc);

create index if not exists fire_pipeline_runs_completed_at_idx
  on public.fire_pipeline_runs (completed_at desc)
  where completed_at is not null;

create index if not exists fire_pipeline_runs_retry_of_idx
  on public.fire_pipeline_runs (retry_of)
  where retry_of is not null;

alter table public.fire_pipeline_runs enable row level security;

-- Backend-only: sin políticas para anon/authenticated

create or replace function public.fire_pipeline_try_advisory_lock()
returns boolean
language sql
security definer
set search_path = public
as $$
  select pg_try_advisory_lock(hashtext('terramind_fire_pipeline'));
$$;

create or replace function public.fire_pipeline_release_advisory_lock()
returns boolean
language sql
security definer
set search_path = public
as $$
  select pg_advisory_unlock(hashtext('terramind_fire_pipeline'));
$$;

revoke all on function public.fire_pipeline_try_advisory_lock() from public;
revoke all on function public.fire_pipeline_try_advisory_lock() from anon;
revoke all on function public.fire_pipeline_try_advisory_lock() from authenticated;
grant execute on function public.fire_pipeline_try_advisory_lock() to service_role;

revoke all on function public.fire_pipeline_release_advisory_lock() from public;
revoke all on function public.fire_pipeline_release_advisory_lock() from anon;
revoke all on function public.fire_pipeline_release_advisory_lock() from authenticated;
grant execute on function public.fire_pipeline_release_advisory_lock() to service_role;

-- Métricas detalladas de actualización temporal de estados
create or replace function public.fire_events_refresh_temporal_status_metrics()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_activated integer := 0;
  v_monitoring integer := 0;
  v_closed integer := 0;
  v_unchanged integer := 0;
  v_updated integer := 0;
begin
  with candidates as (
    select
      id,
      status as old_status,
      case
        when status = 'new' then status
        when last_detected_at >= now() - interval '12 hours' then 'active'
        when last_detected_at >= now() - interval '24 hours' then 'monitoring'
        else 'closed'
      end as new_status
    from public.fire_events
    where status in ('new', 'active', 'monitoring')
      and validation_status <> 'confirmado'
  ),
  changes as (
    select * from candidates where old_status is distinct from new_status
  )
  select
    count(*) filter (where new_status = 'active' and old_status <> 'active'),
    count(*) filter (where new_status = 'monitoring' and old_status <> 'monitoring'),
    count(*) filter (where new_status = 'closed' and old_status <> 'closed'),
    count(*) filter (where old_status = new_status)
  into v_activated, v_monitoring, v_closed, v_unchanged
  from candidates;

  update public.fire_events e
  set status = c.new_status,
      updated_at = now()
  from (
    select
      id,
      case
        when status = 'new' then status
        when last_detected_at >= now() - interval '12 hours' then 'active'
        when last_detected_at >= now() - interval '24 hours' then 'monitoring'
        else 'closed'
      end as new_status
    from public.fire_events
    where status in ('new', 'active', 'monitoring')
      and validation_status <> 'confirmado'
  ) c
  where e.id = c.id
    and e.status is distinct from c.new_status;

  get diagnostics v_updated = row_count;

  return jsonb_build_object(
    'rows_updated', v_updated,
    'events_activated', v_activated,
    'events_monitoring', v_monitoring,
    'events_closed', v_closed,
    'events_unchanged', v_unchanged
  );
end;
$$;

revoke all on function public.fire_events_refresh_temporal_status_metrics() from public;
revoke all on function public.fire_events_refresh_temporal_status_metrics() from anon;
revoke all on function public.fire_events_refresh_temporal_status_metrics() from authenticated;
grant execute on function public.fire_events_refresh_temporal_status_metrics() to service_role;
