-- 011_population_intelligence_core.sql
-- PROPUESTA — NO APLICADA (7D.1 diseño)
-- Núcleo de inteligencia poblacional territorial genérico

CREATE EXTENSION IF NOT EXISTS postgis;

-- Catálogo de fuentes (oficial + modeladas)
CREATE TABLE IF NOT EXISTS population_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code text NOT NULL UNIQUE,
  name text NOT NULL,
  organization text,
  dataset_name text,
  source_version text NOT NULL,
  reference_year integer NOT NULL,
  license text,
  attribution text,
  methodology text,
  spatial_resolution_m numeric,
  is_official boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Estadísticas administrativas oficiales (INE)
CREATE TABLE IF NOT EXISTS population_admin_statistics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES population_sources(id),
  admin_level text NOT NULL CHECK (admin_level IN ('department', 'municipality')),
  admin_code text NOT NULL,
  admin_name text NOT NULL,
  reference_year integer NOT NULL,
  population_total bigint,
  population_urban bigint,
  population_rural bigint,
  households bigint,
  projection_method text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, admin_level, admin_code, reference_year)
);

CREATE INDEX IF NOT EXISTS idx_population_admin_statistics_level_code
  ON population_admin_statistics (admin_level, admin_code);

-- Metadatos de rasters poblacionales (sin píxeles en tablas normales)
CREATE TABLE IF NOT EXISTS population_raster_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES population_sources(id),
  dataset_code text NOT NULL,
  reference_year integer NOT NULL,
  raster_type text NOT NULL DEFAULT 'population_count',
  population_type text NOT NULL DEFAULT 'resident'
    CHECK (population_type IN ('resident', 'present', 'official_census')),
  spatial_resolution_m numeric NOT NULL,
  crs text NOT NULL,
  storage_reference text NOT NULL,
  checksum text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, dataset_code, reference_year)
);

-- Contexto poblacional por entidad genérica (evento, área, cuenca, etc.)
CREATE TABLE IF NOT EXISTS entity_population_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  context_version text NOT NULL,
  source_dataset_id uuid REFERENCES population_raster_datasets(id),
  reference_year integer NOT NULL,
  analysis_geometry_type text,
  estimated_population numeric,
  official_population_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  nearest_settlements jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'complete', 'partial', 'unavailable', 'error')),
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, context_version)
);

CREATE INDEX IF NOT EXISTS idx_entity_population_context_entity
  ON entity_population_context (entity_type, entity_id);

-- Zonas/buffers derivados (500m–5km)
CREATE TABLE IF NOT EXISTS entity_population_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id uuid NOT NULL REFERENCES entity_population_context(id) ON DELETE CASCADE,
  radius_m integer NOT NULL CHECK (radius_m > 0),
  estimated_population numeric NOT NULL DEFAULT 0,
  adjusted_population numeric,
  population_density_per_km2 numeric,
  analyzed_area_ha numeric,
  data_coverage_pct numeric,
  adjustment_factor numeric,
  adjustment_method text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (context_id, radius_m)
);

CREATE INDEX IF NOT EXISTS idx_entity_population_zones_context
  ON entity_population_zones (context_id);

COMMENT ON TABLE population_sources IS
  'Catálogo de fuentes oficiales (INE) y modeladas (WorldPop, GHSL).';

COMMENT ON TABLE population_admin_statistics IS
  'Cifras oficiales administrativas; no sustituyen estimación raster.';

COMMENT ON TABLE population_raster_datasets IS
  'Referencias a COG/rasters versionados fuera de Git; sin almacenar píxeles.';

COMMENT ON TABLE entity_population_context IS
  'Contexto poblacional genérico por entidad territorial o evento.';

COMMENT ON COLUMN entity_population_context.official_population_context IS
  'JSON con official_administrative_population (INE) separado de modelled_spatial.';

COMMENT ON TABLE entity_population_zones IS
  'Resultados por radio; adjusted_population solo tras reconciliación INE mismo año que raster.';

COMMENT ON COLUMN entity_population_zones.adjustment_factor IS
  'factor = proyección_INE_año_raster / suma_raster_municipio; NULL si años incompatibles o sin dato municipal.';
