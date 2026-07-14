-- 036_news_document_analysis.sql
-- TerraMind — Bloque N2: análisis documental con IA (afirmaciones, hechos, señales).
-- Additive. No crea eventos ni amenazas.

-- ---------------------------------------------------------------------------
-- Análisis documental
-- ---------------------------------------------------------------------------

create table if not exists public.news_document_analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.news_documents (id) on delete cascade,
  analysis_version text not null default 'document-analysis.v1',
  model_provider text,
  model_name text,
  prompt_version text not null,
  input_hash text not null,
  status text not null default 'queued' check (status in (
    'queued', 'processing', 'completed', 'completed_with_warnings',
    'failed', 'needs_review', 'rejected'
  )),
  relevance_score numeric check (relevance_score is null or (relevance_score >= 0 and relevance_score <= 1)),
  analysis_confidence numeric check (
    analysis_confidence is null or (analysis_confidence >= 0 and analysis_confidence <= 1)
  ),
  primary_fact jsonb,
  related_facts jsonb not null default '[]'::jsonb,
  entities jsonb not null default '[]'::jsonb,
  relationships jsonb not null default '[]'::jsonb,
  locations jsonb not null default '[]'::jsonb,
  temporal_references jsonb not null default '[]'::jsonb,
  uncertainties jsonb not null default '[]'::jsonb,
  unknowns jsonb not null default '[]'::jsonb,
  event_candidate jsonb,
  sensitivity_flags jsonb not null default '[]'::jsonb,
  review_status text not null default 'pending' check (review_status in (
    'pending', 'approved', 'rejected', 'corrected'
  )),
  reviewed_by uuid references public.user_profiles (id),
  reviewed_at timestamptz,
  raw_model_response jsonb,
  validation_result jsonb not null default '{}'::jsonb,
  token_usage jsonb not null default '{}'::jsonb,
  estimated_cost_usd numeric,
  requires_human_review boolean not null default false,
  review_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists news_document_analyses_document_idx
  on public.news_document_analyses (document_id, created_at desc);

create index if not exists news_document_analyses_status_idx
  on public.news_document_analyses (status, created_at desc);

create index if not exists news_document_analyses_review_idx
  on public.news_document_analyses (requires_human_review, status);

-- ---------------------------------------------------------------------------
-- Afirmaciones trazables
-- ---------------------------------------------------------------------------

create table if not exists public.news_claims (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null references public.news_document_analyses (id) on delete cascade,
  claim_type text not null check (claim_type in (
    'action', 'state', 'decision', 'change', 'measurement', 'consequence',
    'allegation', 'prediction', 'denial', 'confirmation', 'relationship'
  )),
  statement text not null,
  epistemic_status text not null check (epistemic_status in (
    'explicitly_reported', 'attributed_report', 'inferred', 'uncertain', 'contradicted'
  )),
  confidence numeric not null check (confidence >= 0 and confidence <= 1),
  evidence_references jsonb not null default '[]'::jsonb,
  subject_entity_ids jsonb not null default '[]'::jsonb,
  object_entity_ids jsonb not null default '[]'::jsonb,
  location_ids jsonb not null default '[]'::jsonb,
  temporal_reference_ids jsonb not null default '[]'::jsonb,
  quantity numeric,
  unit text,
  sensitivity text,
  validation_status text not null default 'pending' check (validation_status in (
    'pending', 'accepted', 'adjusted', 'rejected'
  )),
  validation_notes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists news_claims_analysis_idx on public.news_claims (analysis_id);

-- ---------------------------------------------------------------------------
-- Permisos N2
-- ---------------------------------------------------------------------------

insert into public.permissions (id, category, label) values
  ('news.analysis.view', 'news', 'Ver análisis documental de noticias'),
  ('news.analysis.run', 'news', 'Ejecutar análisis documental de noticias'),
  ('news.analysis.review', 'news', 'Revisar análisis documental de noticias')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r, p
from (values
  ('platform_admin', 'news.analysis.view'),
  ('organization_admin', 'news.analysis.view'),
  ('operations_coordinator', 'news.analysis.view'),
  ('field_supervisor', 'news.analysis.view'),
  ('analyst', 'news.analysis.view'),
  ('viewer', 'news.analysis.view'),
  ('platform_admin', 'news.analysis.run'),
  ('organization_admin', 'news.analysis.run'),
  ('operations_coordinator', 'news.analysis.run'),
  ('analyst', 'news.analysis.run'),
  ('platform_admin', 'news.analysis.review'),
  ('organization_admin', 'news.analysis.review'),
  ('analyst', 'news.analysis.review')
) as grants(r, p)
on conflict do nothing;
