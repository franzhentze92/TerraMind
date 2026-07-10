# Rollback geográfico (Commit 3A)

**No ejecutar en flujo normal.** Solo para recuperación manual.

```sql
-- 1. Revertir clasificación de detecciones
UPDATE public.fire_detections SET
  is_inside_guatemala = NULL,
  country_code = NULL,
  department_id = NULL,
  municipality_id = NULL,
  geography_method = 'unresolved',
  geography_confidence = NULL;

-- 2. Eliminar departamentos importados
DELETE FROM public.geo_departments WHERE country_code = 'GT';

-- 3. Quitar polígono nacional (conservar fila GT)
UPDATE public.geo_countries
SET boundary = NULL, source_pcode = NULL
WHERE code = 'GT';

-- 4. Eliminar funciones
DROP FUNCTION IF EXISTS public.classify_fire_detections_geography(integer, boolean);
DROP FUNCTION IF EXISTS public.normalize_boundary_geojson(jsonb);
DROP FUNCTION IF EXISTS public.normalize_boundary(geometry);

-- 5. Opcional: quitar columnas source_pcode
-- ALTER TABLE public.geo_departments DROP COLUMN IF EXISTS source_pcode;
-- ALTER TABLE public.geo_countries DROP COLUMN IF EXISTS source_pcode;
```

Los artefactos en `data/geo/sources/` permanecen en disco.
