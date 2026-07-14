-- 040_emisoras_unidas_source.sql
-- TerraMind — Bloque N1.5-A: segunda fuente periodística (Emisoras Unidas)
-- Additive seed only. Compatible with existing Prensa Libre documents/analyses.

insert into public.news_sources (
  code,
  name,
  source_type,
  country_code,
  primary_language,
  base_url,
  logo_url,
  discovery_method,
  feed_urls,
  sitemap_urls,
  robots_url,
  access_policy,
  content_retention_policy,
  reliability_profile,
  geographic_coverage,
  thematic_coverage,
  is_enabled,
  ingestion_frequency_minutes,
  connector_config,
  metadata
) values (
  'emisoras_unidas_gt',
  'Emisoras Unidas',
  'national_press',
  'GT',
  'es',
  'https://emisorasunidas.com',
  'https://emisorasunidas.com/apple-touch-icon.png',
  'news_sitemap',
  '["https://emisorasunidas.com/feed/"]'::jsonb,
  '["https://emisorasunidas.com/sitemap/news-sitemap.xml","https://emisorasunidas.com/sitemap.xml"]'::jsonb,
  'https://emisorasunidas.com/robots.txt',
  'metadata_only',
  'excerpt_and_metadata',
  '{"attribution":"Fuente periodística","editorial_role":"news_media","note":"La confiabilidad de cada afirmación se evalúa por evidencia y corroboración, no por el nombre del medio."}'::jsonb,
  '{"country":"GT","scope":"national"}'::jsonb,
  '["nacional","internacional","economia","tecnologia","seguridad","politica","salud","ambiente"]'::jsonb,
  true,
  60,
  '{
    "windowHours": 72,
    "maxArticles": 30,
    "rateLimitMs": 1500,
    "requestTimeoutMs": 15000,
    "maxRedirects": 5,
    "allowedDomains": ["emisorasunidas.com", "www.emisorasunidas.com", "img.emisorasunidas.com"],
    "categoryPathPrefixes": ["/nacional/", "/internacionales/", "/empresas/", "/tecnologia/"],
    "excludePathPrefixes": ["/universo-futbol/", "/deportes/", "/farandula/", "/viral/", "/videos/"],
    "userAgent": "TerraMind-NewsBot/1.0 (+https://terramind.local; contact=news-ingestion)",
    "revalidateAfterHours": 24,
    "liveCoverageRevalidateMinutes": 30,
    "correctionRevalidateHours": 6
  }'::jsonb,
  '{
    "robotsNote": "Allow:/; Disallow:/preview/ y SDK Marfeel. News-sitemap y sitemaps anuales declarados. RSS /feed/ permitido pero no usado como corpus (description con HTML sustancial).",
    "termsUrl": "https://emisorasunidas.com/",
    "attributionLabel": "Fuente periodística",
    "futureN3": "cross_source_group_id nullable — necesidad futura para agrupación N3; no operativo en N1.5-A",
    "editorialCategoryMap": {
      "nacional": "Nacional",
      "internacionales": "Internacional",
      "empresas": "Economía",
      "tecnologia": "Tecnología",
      "deportes": "Deportes",
      "universo-futbol": "Deportes",
      "farandula": "Entretenimiento"
    }
  }'::jsonb
) on conflict (code) do nothing;
