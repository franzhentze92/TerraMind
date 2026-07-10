# Auditoría de duplicados — CONAP SIGAP 2025

| Métrica | Valor |
|---------|-------|
| Registros fuente | 406 |
| Features geográficas únicas | 405 |
| Duplicados exactos descartados | 1 |
| Errores reales de importación | 0 |

## Criterio de descarte

Un registro se descarta como **duplicado exacto** cuando comparte:

- `logical_area_key`
- hash de geometría normalizada (EPSG:4326)
- códigos general y específico
- nombres y categorías general/específica

No se añade sufijo artificial para inflar el conteo.

## Registros descartados

### Fila fuente 401

- source_feature_id: `26c7bc986ccc29449bf788b3960da10f240e1eddd2c958e5ee20159cc29fc51d`
- logical_area_key: `79|177|sierra de las minas|lote "9"`
- geometry_hash: `1fa6de2e651c91e2…`
- coincide con registro previo: sí
- diferencia material: ninguna

