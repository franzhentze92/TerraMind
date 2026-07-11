# HDX COD-AB Guatemala — Fuente geográfica TerraMind

## Dataset

| Campo | Valor |
|-------|-------|
| **Título** | Guatemala - Subnational Administrative Boundaries |
| **Entidad publicadora** | OCHA / HDX (fuente institucional: Coordinadora Nacional para la Reducción de Desastres — CONRED) |
| **Dataset HDX** | [cod-ab-gtm](https://data.humdata.org/dataset/cod-ab-gtm) |
| **UUID dataset** | `0b20f310-7d22-479c-b7e2-e1bb9737fa72` |
| **Versión dataset** | v01 (`valid_on`: 2019-02-07, revisado 2025-10-30) |
| **Fecha de descarga** | 2026-07-10 |
| **Carpeta TerraMind** | `2025-10-30-v01` |

## Licencia

**Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO)**

Atribución requerida al usar o redistribuir:

> Guatemala administrative boundaries from HDX COD-AB (OCHA/CONRED).  
> Licencia: CC BY-IGO. https://data.humdata.org/dataset/cod-ab-gtm

## Archivos y hashes SHA-256

| Archivo | SHA-256 |
|---------|---------|
| `gtm_admin_boundaries.geojson.zip` | `f178eda98c46329380bdbb43f0637b4c43535bc843de6a0b8b960193b8f4363f` |
| `extracted/gtm_admin0.geojson` | `5fdf634557291e46f917c4f4151dbcf984a295d1ddffc257cc9826800e6539b9` |
| `extracted/gtm_admin1.geojson` | `a2c65090aad6932f526f10b818ff671346ea0f2b21e0c73618e4c2755565adf7` |
| `extracted/gtm_admin2.geojson` | `faaf1922df4ac0c5c43f3d7255a7551369294fef1d008ac52dc4de9b7bbb3144` |

## Niveles administrativos usados (Commit 3A)

| Nivel | Archivo | Geometrías | Uso TerraMind |
|-------|---------|------------|---------------|
| ADM0 | `gtm_admin0.geojson` | 1 | `geo_countries` (GT) |
| ADM1 | `gtm_admin1.geojson` | 22 | `geo_departments` |
| ADM2 | `gtm_admin2.geojson` | 342 | **Agregación municipal** de déficit de precipitación (Rainfall Deficit Activation) |

## ADM2 — agregación municipal (Rainfall Deficit)

- Importación **no destructiva**: el archivo `extracted/gtm_admin2.geojson` ya estaba
  versionado en el repositorio (misma fuente oficial HDX COD-AB que ADM1); solo se
  re-extrajo a disco. No se modificó ADM0 ni ADM1.
- 342 features = 340 municipios + tratamiento especial de 2 lagos (Amatitlán, Atitlán).
  341 `Polygon` + 1 `MultiPolygon`.
- Campos usados: `adm2_pcode` (GT + 4 dígitos), `adm2_name`, `adm1_pcode`, `adm1_name`,
  `area_sqkm`, `center_lat`, `center_lon`.
- Uso: asignación celda CHIRPS → municipio por punto-en-polígono (con soporte de huecos
  y multipartes) y agregación **ponderada por área** (coseno de latitud). Los percentiles
  se calculan a nivel municipal a partir de la serie municipal acumulada; **nunca** se
  promedian percentiles por celda.
- Municipios sin centro de celda (muy pequeños/slivers) usan la celda más cercana como
  respaldo y se marcan como baja cobertura.

## CRS

EPSG:4326 (WGS 84). Coordenadas geográficas en GeoJSON.

## Campos relevantes

**ADM0:** `adm0_pcode` (GT), `adm0_name`, `iso2`, `iso3`, `area_sqkm`, `valid_on`, `version`

**ADM1:** `adm1_pcode` (GT01–GT22), `adm1_name`, `adm0_pcode`, `area_sqkm`, `valid_on`, `version`

**Mapeo TerraMind:** `geo_departments.code` = dos dígitos INE (`01`–`22`) derivados de `adm1_pcode`.  
`geo_departments.source_pcode` = `adm1_pcode` original.

## Limitaciones conocidas

1. Excluye el territorio soberano de Belice reconocido por la ONU; la frontera GT/BZ es responsabilidad del usuario al visualizar.
2. Dos lagos (Amatitlán, Atitlán) tienen tratamiento especial en ADM2; no afectan Commit 3A.
3. Límite nacional **no** se deriva por unión de departamentos en operación; ADM0 explícito es la geometría activa. La unión ADM1 se usa solo como control de calidad.

## Fuente de comparación (no operativa)

MINFIN TopoJSON v1.0.0 — [github.com/minfin-bi/Mapas-TopoJSON-Guatemala](https://github.com/minfin-bi/Mapas-TopoJSON-Guatemala)  
Usada solo para validación cruzada local, no insertada en `geo_departments`.

## Referencia institucional cartográfica

Instituto Geográfico Nacional (IGN), MAGA — [ign.gob.gt](http://www.ign.gob.gt/)  
Autoridad cartográfica nacional; upgrade futuro cuando shapefiles IGN estén disponibles.
