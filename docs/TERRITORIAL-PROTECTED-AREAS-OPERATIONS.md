# Operaciones — Áreas protegidas SIGAP (Commit 7A.1)

## Fuente

- **Primaria:** CONAP `SIGAP_08122025_IP` en `data/geo/sources/conap-sigap-guatemala/2025-12-08-v01/`
- **Control:** INAB `SIGAP_05_2022` (reporte `INAB-COMPARISON.md`, no operativa)

## Importación

```bash
npm run geo:import-protected-areas
```

Valida: 406 registros, geometrías 4326 válidas, IDs determinísticos, 5 reparaciones esperadas.

## Enriquecimiento

```bash
npm run fires:enrich-protected-areas
npm run fires:enrich-protected-areas -- --limit 100
npm run fires:enrich-protected-areas -- --force
```

Semántica:
- `inside_protected_area` = detección FIRMS real dentro (`ST_Covers`)
- `diagnostic_geometry_intersects_protected_area` = buffer visual ~375 m (no equivale a inside)
- `nearest_protected_area_distance_m` = mínimo desde detecciones reales

## API

`GET /api/environment/fires/events/:id` incluye `protected_area_context` (DTO seguro, sin geometrías).

## UI

Panel de evento → pestaña **Territorio**.

## Scheduler

Conectado al pipeline FIRMS como etapa `protected_area_enrichment` (post clustering y estados).

Solo reprocesa eventos nuevos, sin contexto, con detecciones nuevas o `context_version` desactualizado.

## Fuera de alcance

`risk_level`, `priority_score`, hallazgos, Copilot.
