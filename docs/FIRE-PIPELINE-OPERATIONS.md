# Operación del pipeline FIRMS — TerraMind

Este documento describe el scheduler automático del pipeline de incendios:
ingesta FIRMS → geografía → clustering → actualización de estados.

## Flujo

```text
runFireIngestion()
  → classify_fire_detections_geography (incremental)
  → runClusterPipeline({ dryRun: false })
  → fire_events_refresh_temporal_status_metrics()
```

Cada corrida se registra en `fire_pipeline_runs` con métricas por etapa.

## Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `FIRE_PIPELINE_ENABLED` | `true` | Activa el scheduler en el backend |
| `FIRE_PIPELINE_INTERVAL_MINUTES` | `30` | Intervalo (15–1440 min) |
| `FIRE_PIPELINE_RUN_ON_STARTUP` | `false` | Ejecutar al arrancar el servidor |
| `FIRE_PIPELINE_TIMEZONE` | `America/Guatemala` | Referencia operativa |
| `NASA_FIRMS_MAP_KEY` | — | Requerida para ingesta |
| `SUPABASE_URL` | — | Backend Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Solo servidor |

## Ejecución manual

```bash
npm run fires:pipeline
npm run fires:pipeline:status
```

El botón **Actualizar** en la UI solo hace refetch de datos; no ejecuta el pipeline.

## Scheduler local (MVP)

El scheduler vive en `src/pipeline/scheduler/fire.scheduler.ts` y se inicia con `npm run server`.

**Importante para producción:** con múltiples réplicas del backend, cada instancia registraría su propio timer. El **advisory lock** de PostgreSQL evita ejecuciones concurrentes, pero en producción se recomienda migrar a cron externo, Supabase Cron o worker dedicado.

## Bloqueo de concurrencia

- Índice único parcial: solo una corrida `running` por `lock_key`
- Advisory lock PostgreSQL como refuerzo (puede variar con pooler de Supabase)
- Si no se obtiene: corrida `skipped`, reason `concurrent_run`

## Reintentos

Solo errores transitorios (red, timeout, HTTP 5xx):

- Máximo 3 intentos (1 inicial + 2 reintentos)
- Backoff: 30 s, 90 s + jitter
- No reintentar credenciales inválidas ni errores de esquema
- Máximo una corrida retry por hora para el mismo `retry_of`

## Timeouts por etapa

| Etapa | Límite |
|-------|--------|
| FIRMS por fuente | 30 s |
| Ingesta total | 3 min |
| Geografía | 1 min |
| Clustering | 2 min |
| Pipeline completo | 7 min |

## Health API

`GET /api/environment/fires/pipeline/health`

### Alertas internas

| Nivel | Condición |
|-------|-----------|
| Warning | 2 fallos consecutivos o sin éxito en 90 min |
| Critical | 4 fallos consecutivos o sin éxito en 4 h |

## Recuperación

1. `npm run fires:pipeline:status`
2. Revisar `fire_pipeline_runs`
3. Corregir causa (MAP_KEY, Supabase, red)
4. `npm run fires:pipeline`
5. Desactivar: `FIRE_PIPELINE_ENABLED=false`

## Retención

No se borran registros automáticamente. Política futura: detalle 90 días, agregados más tiempo.
