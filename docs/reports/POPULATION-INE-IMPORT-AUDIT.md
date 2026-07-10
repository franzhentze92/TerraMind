# Informe de importación INE — Población administrativa (7D.2)

**Fecha:** 2026-07-10  
**Migración:** `012_population_intelligence_core.sql` — **aplicada** en Supabase remoto

## Resumen

Se incorporaron cifras administrativas oficiales de Guatemala y contexto de cabeceras municipales (complemento HDX) **sin ajustar píxeles WorldPop**. La arquitectura distingue siempre:

- `official_administrative_population` (INE)
- `modelled_spatial_population` (WorldPop)

## Fuentes documentadas

| ID | Fuente | Año ref. | Nivel | Tipo | Licencia |
|----|--------|----------|-------|------|----------|
| `ine_census_2018` | INE — XII Censo 2018 | 2018 | Nacional, 22 dept., muestra municipal | Censo | Institucional pública |
| `ine_projection_2020` | INE — Proyecciones dept. 2010-2050 | 2020 | Nacional + 22 departamentos | Proyección | Institucional pública |
| `hdx_cod_ab_municipal_seats` | HDX COD-AB admin points | 2019 | 342 cabeceras municipales | Complemento | CC BY-IGO |

**No importado en 7D.2:** proyección municipal 2020 completa, lugares poblados INE 2018 con población por asentamiento, geometría ADM2 operativa.

## Alineación temporal

| Capa | Año |
|------|-----|
| WorldPop constrained/unconstrained | **2020** |
| INE comparación primaria | **Proyección 2020** |
| INE censo | **2018** (separado; warning `official_year_mismatch` si se solicita 2020) |

`temporal_alignment_with_worldpop`: **exact** (proyección departamental 2020 disponible).

## Importación local

| Métrica | Valor |
|---------|-------|
| Registros admin | 48 |
| Departamentos censo 2018 | 22 |
| Departamentos proyección 2020 | 22 |
| Nacional censo 2018 | 14,901,286 |
| Nacional proyección 2020 | 17,980,803 |
| Municipios muestra (censo 2018) | 2 (Guatemala, Champerico) |
| Asentamientos (cabeceras) | 342 |
| Checksum | `5341d0234dc06a951b7f250fbf45cc678643f8314c1656ede8b3dc5e3ab30221` |
| Dry-run warnings | 0 |
| Idempotencia | Verificada (segunda corrida dry-run = mismo checksum) |

**Salida:** `data/population/ine/processed/admin_statistics.json`, `settlements.json`

## Códigos administrativos

- Canónico departamento: `01`–`22` (INE) ↔ `GT01`–`GT22` (HDX COD-AB)
- Canónico municipio: `DDMM` ↔ `GTDDMM`
- Crosswalk: embebido en registros importados; tabla `population_admin_crosswalk` en migración 012
- ADM2 geometrías: **no operativas** — comparación raster municipal diferida

## WorldPop vs INE (departamental, proyección 2020)

Comparación raster requiere geometría ADM1 (`gtm_admin1.geojson`). Ejecutar `population:download-ine` para extraer límites HDX si faltan.

**Nacional (referencia):**

| Fuente | Población 2020 |
|--------|----------------|
| INE proyección | 17,980,803 |
| WorldPop constrained (ADM0) | ~17.22 M (ver auditoría WorldPop) |
| WorldPop unconstrained (ADM0) | ~18.0 M |

## Auditoría: rural Huehuetenango

**Coordenadas:** 15.3147, -91.4761

| Radio | Constrained | Unconstrained | Δ % |
|-------|-------------|---------------|-----|
| 500 m | 3,483 | 380 | 89.1% |
| **1 km** | **12,819** | **1,467** | **88.6%** |
| 3 km | 64,570 | 15,277 | 76.3% |

**Contexto oficial:** Departamento Huehuetenango — proyección INE 2020: **1,209,607**

**Cabecera más cercana:** Malacatancito (muni. 1303) — **8.9 km**

**Conclusión:** `requires_caution` — diferencia extrema entre variantes; no declarar coherencia automática; no comparar buffer con total departamental.

## Por qué no se ajustó el raster

1. Proyección municipal 2020 no disponible en importación inicial  
2. Geometría ADM2 no validada operativamente  
3. Casos como Huehuetenango rural muestran constrained ≠ ground truth sin contexto  
4. Política 7D.2: solo importar, armonizar y comparar

## Rollback migración 012

```sql
drop table if exists public.entity_population_zones cascade;
drop table if exists public.entity_population_context cascade;
drop table if exists public.population_raster_datasets cascade;
drop table if exists public.population_settlements cascade;
drop table if exists public.population_admin_crosswalk cascade;
drop table if exists public.population_admin_statistics cascade;
drop table if exists public.population_sources cascade;
```
