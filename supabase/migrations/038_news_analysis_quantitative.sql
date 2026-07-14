-- 038_news_analysis_quantitative.sql
-- TerraMind — N2 v2.3: extensiones cuantitativas y multisectoriales.
-- Aditivo y opcional: las noticias narrativas dejan estas columnas vacías/null.

alter table public.news_document_analyses
  add column if not exists metrics jsonb not null default '[]'::jsonb,
  add column if not exists sector_relevance jsonb not null default '[]'::jsonb,
  add column if not exists threat_hint jsonb,
  add column if not exists classification jsonb,
  add column if not exists reporting_period jsonb;
