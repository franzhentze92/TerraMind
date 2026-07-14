-- 037_news_analysis_quality.sql
-- TerraMind — Ajuste de calidad N2: resumen analítico persistido.
-- Additive.

alter table public.news_document_analyses
  add column if not exists analytical_summary text;
