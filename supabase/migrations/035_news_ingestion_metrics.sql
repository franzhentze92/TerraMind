-- 035_news_ingestion_metrics.sql
-- TerraMind — N1 endurecimiento: métricas diferenciadas + control de revalidación.
-- Additive and non-destructive. Review before remote activation.

-- Marca de última revalidación para evitar re-descargar cada corrida.
alter table public.news_documents
  add column if not exists last_revalidated_at timestamptz;

-- Métricas diferenciadas por corrida.
alter table public.news_ingestion_runs
  add column if not exists revalidated integer not null default 0;

alter table public.news_ingestion_runs
  add column if not exists http_requests_made integer not null default 0;

alter table public.news_ingestion_runs
  add column if not exists http_requests_avoided integer not null default 0;

alter table public.news_ingestion_runs
  add column if not exists duration_ms integer;
