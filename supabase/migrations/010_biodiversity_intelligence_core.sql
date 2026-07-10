-- 010_biodiversity_intelligence_core.sql
-- PROPUESTA — NO APLICADA
-- Commit 7C.1: núcleo de inteligencia de biodiversidad (GBIF + iNaturalist)

CREATE EXTENSION IF NOT EXISTS postgis;

-- Catálogo de fuentes de datos
CREATE TABLE IF NOT EXISTS biodiversity_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code text NOT NULL UNIQUE,
  name text NOT NULL,
  organization text,
  api_url text,
  license_summary text,
  authority_level text NOT NULL DEFAULT 'aggregated'
    CHECK (authority_level IN ('primary', 'aggregated', 'citizen_science')),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Taxa normalizados con mapeos por fuente
CREATE TABLE IF NOT EXISTS biodiversity_taxa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_taxon_key text,
  scientific_name text NOT NULL,
  canonical_name text,
  rank text,
  kingdom text,
  phylum text,
  class_name text,
  order_name text,
  family text,
  genus text,
  species text,
  source_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  conservation_statuses jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biodiversity_taxa_scientific_name
  ON biodiversity_taxa (lower(scientific_name));

CREATE UNIQUE INDEX IF NOT EXISTS idx_biodiversity_taxa_canonical_key
  ON biodiversity_taxa (canonical_taxon_key)
  WHERE canonical_taxon_key IS NOT NULL;

-- Ocurrencias normalizadas
CREATE TABLE IF NOT EXISTS biodiversity_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES biodiversity_sources(id),
  source_occurrence_id text NOT NULL,
  taxon_id uuid REFERENCES biodiversity_taxa(id),
  observed_at timestamptz,
  basis_of_record text,
  quality_grade text,
  location geography(Point, 4326),
  coordinate_uncertainty_m numeric,
  coordinates_obscured boolean NOT NULL DEFAULT false,
  privacy_level text NOT NULL DEFAULT 'public_exact'
    CHECK (privacy_level IN (
      'public_exact',
      'public_generalized',
      'sensitive_generalized',
      'private_unavailable'
    )),
  captive_or_cultivated boolean,
  license text,
  attribution text,
  source_url text NOT NULL,
  source_dataset_id text,
  publishing_organization text,
  possible_duplicate boolean NOT NULL DEFAULT false,
  duplicate_group_id text,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, source_occurrence_id)
);

CREATE INDEX IF NOT EXISTS idx_biodiversity_occurrences_observed_at
  ON biodiversity_occurrences (observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_biodiversity_occurrences_location
  ON biodiversity_occurrences USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_biodiversity_occurrences_duplicate_group
  ON biodiversity_occurrences (duplicate_group_id)
  WHERE duplicate_group_id IS NOT NULL;

-- Auditoría de consultas/fetch
CREATE TABLE IF NOT EXISTS biodiversity_fetch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  query_hash text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('running', 'completed', 'failed', 'partial')),
  records_received integer NOT NULL DEFAULT 0,
  records_inserted integer NOT NULL DEFAULT 0,
  records_updated integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  error_code text,
  safe_error_message text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biodiversity_fetch_runs_provider_started
  ON biodiversity_fetch_runs (provider, started_at DESC);

-- Semillas de fuentes
INSERT INTO biodiversity_sources (source_code, name, organization, api_url, license_summary, authority_level, metadata)
VALUES
  (
    'gbif',
    'Global Biodiversity Information Facility',
    'GBIF',
    'https://api.gbif.org',
    'Varía por dataset y registro; verificar licencia por ocurrencia',
    'aggregated',
    '{"terms":"https://www.gbif.org/terms","download_api_required_for_bulk":true}'::jsonb
  ),
  (
    'inaturalist',
    'iNaturalist',
    'California Academy of Sciences / National Geographic Society',
    'https://api.inaturalist.org/v1',
    'Varía por observador; CC0/CC-BY/CC-BY-NC según observación',
    'citizen_science',
    '{"terms":"https://www.inaturalist.org/pages/terms","gbif_dataset_key":"50c9509d-22c7-4a22-a47d-8c48425ef4a7"}'::jsonb
  )
ON CONFLICT (source_code) DO NOTHING;

-- RLS: solo lectura autenticada (ajustar según política TerraMind)
ALTER TABLE biodiversity_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE biodiversity_taxa ENABLE ROW LEVEL SECURITY;
ALTER TABLE biodiversity_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE biodiversity_fetch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY biodiversity_sources_read ON biodiversity_sources
  FOR SELECT TO authenticated USING (true);

CREATE POLICY biodiversity_taxa_read ON biodiversity_taxa
  FOR SELECT TO authenticated USING (true);

CREATE POLICY biodiversity_occurrences_read ON biodiversity_occurrences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY biodiversity_fetch_runs_read ON biodiversity_fetch_runs
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE biodiversity_occurrences IS
  'Registros de presencia reportados; no implica población actual ni ausencia de especie.';
