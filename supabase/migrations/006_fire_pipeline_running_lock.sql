-- Refuerzo de concurrencia: una sola corrida `running` por lock_key (compatible con pooler)

create unique index if not exists fire_pipeline_runs_single_running_idx
  on public.fire_pipeline_runs (lock_key)
  where status = 'running';
