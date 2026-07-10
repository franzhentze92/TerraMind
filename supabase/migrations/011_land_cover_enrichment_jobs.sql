-- TerraMind — Commit 7A.2-F: Jobs de enriquecimiento de cobertura del suelo
-- =============================================================================
-- Numeración: 011 (010 biodiversity core · 012 population · 013 observation media en repo, no aplicadas)
-- Rollback: DROP FUNCTION claim_land_cover_enrichment_job; DROP TABLE land_cover_enrichment_jobs;
-- =============================================================================

create table if not exists public.land_cover_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null
    references public.fire_events(id) on delete cascade,
  requested_context_version text not null,
  status text not null
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority integer not null default 0,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  completed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un solo job activo por evento + versión de contexto
create unique index if not exists land_cover_enrichment_jobs_active_unique_idx
  on public.land_cover_enrichment_jobs (event_id, requested_context_version)
  where status in ('pending', 'processing');

create index if not exists land_cover_enrichment_jobs_status_available_idx
  on public.land_cover_enrichment_jobs (status, available_at, priority desc);

create index if not exists land_cover_enrichment_jobs_event_idx
  on public.land_cover_enrichment_jobs (event_id);

create index if not exists land_cover_enrichment_jobs_locked_at_idx
  on public.land_cover_enrichment_jobs (locked_at)
  where status = 'processing';

-- Reclamo atómico con SKIP LOCKED (multi-instancia)
create or replace function public.claim_land_cover_enrichment_job(
  p_worker_id text,
  p_lock_timeout_minutes integer default 30
)
returns setof public.land_cover_enrichment_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.land_cover_enrichment_jobs;
begin
  -- Liberar locks huérfanos
  update public.land_cover_enrichment_jobs
  set
    status = 'pending',
    locked_at = null,
    locked_by = null,
    updated_at = now()
  where status = 'processing'
    and locked_at is not null
    and locked_at < now() - make_interval(mins => greatest(p_lock_timeout_minutes, 1));

  update public.land_cover_enrichment_jobs j
  set
    status = 'processing',
    locked_at = now(),
    locked_by = p_worker_id,
    started_at = coalesce(j.started_at, now()),
    attempts = j.attempts + 1,
    updated_at = now()
  where j.id = (
    select id
    from public.land_cover_enrichment_jobs
    where status = 'pending'
      and available_at <= now()
      and attempts < max_attempts
    order by priority desc, available_at asc, created_at asc
    limit 1
    for update skip locked
  )
  returning * into v_job;

  if found then
    return next v_job;
  end if;
end;
$$;

revoke all on function public.claim_land_cover_enrichment_job(text, integer) from public;
grant execute on function public.claim_land_cover_enrichment_job(text, integer) to service_role;

alter table public.land_cover_enrichment_jobs enable row level security;

revoke all on table public.land_cover_enrichment_jobs from anon, authenticated;
grant select, insert, update, delete on table public.land_cover_enrichment_jobs to service_role;
