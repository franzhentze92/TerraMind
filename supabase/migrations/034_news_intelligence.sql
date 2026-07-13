-- 034_news_intelligence.sql
-- TerraMind — Bloque N1: red documental de noticias (Prensa Libre piloto)
-- Additive and non-destructive. Review before remote activation.

-- ---------------------------------------------------------------------------
-- Fuentes periodísticas
-- ---------------------------------------------------------------------------

create table if not exists public.news_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  source_type text not null default 'local_press' check (source_type in (
    'local_press', 'national_press', 'official', 'aggregator', 'international'
  )),
  country_code text not null default 'GT',
  primary_language text not null default 'es',
  base_url text not null,
  logo_url text,
  discovery_method text not null check (discovery_method in (
    'rss', 'news_sitemap', 'sitemap', 'section_links', 'aggregator', 'html_listing'
  )),
  feed_urls jsonb not null default '[]'::jsonb,
  sitemap_urls jsonb not null default '[]'::jsonb,
  robots_url text,
  access_policy text not null default 'metadata_only' check (access_policy in (
    'metadata_only', 'excerpt_permitted', 'full_text_restricted', 'blocked'
  )),
  content_retention_policy text not null default 'excerpt_and_metadata' check (
    content_retention_policy in ('metadata_only', 'excerpt_and_metadata', 'full_text_internal')
  ),
  reliability_profile jsonb not null default '{}'::jsonb,
  geographic_coverage jsonb not null default '{}'::jsonb,
  thematic_coverage jsonb not null default '[]'::jsonb,
  is_enabled boolean not null default true,
  ingestion_frequency_minutes integer not null default 60,
  last_successful_ingestion_at timestamptz,
  last_failed_ingestion_at timestamptz,
  consecutive_failure_count integer not null default 0,
  connector_config jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Documentos periodísticos
-- ---------------------------------------------------------------------------

create table if not exists public.news_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.news_sources (id) on delete cascade,
  organization_id uuid references public.organizations (id),
  external_id text,
  canonical_url text not null,
  discovered_url text not null,
  title text not null,
  subtitle text,
  author_names jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  modified_at timestamptz,
  captured_at timestamptz not null default now(),
  source_category text,
  source_tags jsonb not null default '[]'::jsonb,
  language text not null default 'es',
  country_code text not null default 'GT',
  description text,
  permitted_excerpt text,
  image_reference_url text,
  raw_metadata jsonb not null default '{}'::jsonb,
  structured_data jsonb not null default '{}'::jsonb,
  content_hash text not null,
  canonical_url_hash text not null,
  processing_status text not null default 'discovered' check (processing_status in (
    'discovered', 'metadata_extracted', 'ready_for_analysis', 'restricted', 'failed', 'archived'
  )),
  geographic_status text not null default 'sin_ubicacion' check (geographic_status in (
    'localizada', 'ubicacion_aproximada', 'varias_ubicaciones', 'nacional', 'internacional', 'sin_ubicacion'
  )),
  primary_location jsonb,
  location_candidates jsonb not null default '[]'::jsonb,
  is_opinion boolean not null default false,
  is_sponsored boolean not null default false,
  is_correction boolean not null default false,
  is_live_coverage boolean not null default false,
  source_reliability_snapshot jsonb not null default '{}'::jsonb,
  preliminary_category text,
  preliminary_category_confidence numeric check (
    preliminary_category_confidence is null or (
      preliminary_category_confidence >= 0 and preliminary_category_confidence <= 1
    )
  ),
  preliminary_category_reasons jsonb not null default '[]'::jsonb,
  classifier_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists news_documents_canonical_url_hash_idx
  on public.news_documents (canonical_url_hash);

create index if not exists news_documents_source_published_idx
  on public.news_documents (source_id, published_at desc nulls last);

create index if not exists news_documents_processing_status_idx
  on public.news_documents (processing_status, updated_at desc);

create index if not exists news_documents_geographic_status_idx
  on public.news_documents (geographic_status);

create index if not exists news_documents_preliminary_category_idx
  on public.news_documents (preliminary_category);

-- ---------------------------------------------------------------------------
-- Corridas de ingesta
-- ---------------------------------------------------------------------------

create table if not exists public.news_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.news_sources (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  discovery_method text not null,
  urls_discovered integer not null default 0,
  documents_new integer not null default 0,
  documents_updated integer not null default 0,
  duplicates integer not null default 0,
  restricted integer not null default 0,
  errors integer not null default 0,
  result_code text not null default 'pending' check (result_code in (
    'pending', 'success', 'partial', 'failed', 'blocked'
  )),
  message text,
  checkpoint jsonb not null default '{}'::jsonb,
  rate_limit_observed jsonb not null default '{}'::jsonb,
  connector_version text not null,
  error_details jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists news_ingestion_runs_source_started_idx
  on public.news_ingestion_runs (source_id, started_at desc);

-- updated_at triggers
drop trigger if exists news_sources_set_updated_at on public.news_sources;
create trigger news_sources_set_updated_at
  before update on public.news_sources
  for each row execute function public.set_updated_at();

drop trigger if exists news_documents_set_updated_at on public.news_documents;
create trigger news_documents_set_updated_at
  before update on public.news_documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (id, category, label) values
  ('news.view', 'news', 'Ver noticias en vivo'),
  ('news.manage_sources', 'news', 'Gestionar fuentes de noticias'),
  ('news.run_ingestion', 'news', 'Ejecutar ingesta de noticias')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r, 'news.view'
from (values
  ('platform_admin'), ('organization_admin'), ('operations_coordinator'),
  ('field_supervisor'), ('analyst'), ('viewer')
) as roles(r)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select r, p
from (values
  ('platform_admin', 'news.manage_sources'),
  ('organization_admin', 'news.manage_sources'),
  ('platform_admin', 'news.run_ingestion'),
  ('organization_admin', 'news.run_ingestion'),
  ('operations_coordinator', 'news.run_ingestion')
) as grants(r, p)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Seed: Prensa Libre Guatemala
-- ---------------------------------------------------------------------------

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
  'prensa_libre_gt',
  'Prensa Libre',
  'national_press',
  'GT',
  'es',
  'https://www.prensalibre.com',
  'https://www.prensalibre.com/wp-content/uploads/2019/01/cropped-PLico.png',
  'news_sitemap',
  '[]'::jsonb,
  '["https://www.prensalibre.com/news-sitemap.xml","https://www.prensalibre.com/sitemap.xml"]'::jsonb,
  'https://www.prensalibre.com/robots.txt',
  'metadata_only',
  'excerpt_and_metadata',
  '{"tier":"established_national","editorial_standards":"commercial_press"}'::jsonb,
  '{"country":"GT","scope":"national"}'::jsonb,
  '["gobierno","economia","seguridad","justicia","sociedad","deportes","internacional"]'::jsonb,
  true,
  60,
  '{
    "windowHours": 72,
    "maxArticles": 30,
    "rateLimitMs": 1500,
    "requestTimeoutMs": 15000,
    "maxRedirects": 5,
    "allowedDomains": ["www.prensalibre.com", "prensalibre.com"],
    "categoryPathPrefixes": ["/guatemala/"],
    "userAgent": "TerraMind-NewsBot/1.0 (+https://terramind.local; contact=news-ingestion)",
    "revalidateAfterHours": 24,
    "liveCoverageRevalidateMinutes": 30,
    "correctionRevalidateHours": 6
  }'::jsonb,
  '{
    "robotsNote": "RSS /feed/ disallow en robots.txt; usar news-sitemap.xml",
    "termsUrl": "https://www.prensalibre.com/terminos-y-condiciones/"
  }'::jsonb
) on conflict (code) do nothing;
