-- 039_news_analysis_coverage.sql
-- TerraMind — N2 v2.4: cobertura documental y fuente primaria recomendada.
-- Aditivo.

alter table public.news_document_analyses
  add column if not exists document_coverage jsonb,
  add column if not exists recommended_primary_source jsonb;
