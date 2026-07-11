# Actividad térmica — Product Polish & Multi-Event Readiness Audit

**Fecha:** 2026-07-11  
**Base:** `origin/main` post Situación Nacional (`58ff56a`)  
**Alcance:** inventario de acoplamientos FIRMS/fuego/geometría puntual + cierre visual/semántico del módulo actual.  
**Fuera de alcance:** Environmental Event Framework, inundaciones, migraciones de esquema, nuevos motores.

---

## 1. Resumen ejecutivo

Actividad térmica vive hoy bajo la ruta `/incendios` con namespace API `/api/environment/fires/*`. El dominio interno usa `fire_*` en base de datos, servicios y pipeline; la capa de producto debe hablar de **actividad térmica**, **detección térmica** y **evento térmico**.

Este bloque cierra:

- Español completo en UI principal (estado único de datos, KPIs, filtros, tabla, mapa, detalle).
- Contador coherente (`visibleResultCount` = total filtrado del servidor).
- Distinción observación → detección nacional → evento agrupado.
- Limitación científica visible.
- Inventario de piezas reutilizables vs acopladas a FIRMS/fuego.

---

## 2. Problemas visuales y semánticos encontrados (pre-fix)

| Problema | Causa | Corrección |
| -------- | ----- | ---------- |
| KPI “12 eventos” vs filtros “0 resultados” | `placeholderData` en `useFireEvents` mezclaba filas stale con total nuevo; `Math.max` ocultaba discrepancia | Eliminar `placeholderData`; `computeThermalResultCounts` |
| Badges duplicados (desactualizado + parcial + pipeline) | `data_status` y `pipeline/health` renderizados por separado | `resolveThermalDataStatus` + `ThermalDataStatusLine` |
| Título “Incendios y focos de calor” | Copy legacy | “Actividad térmica” |
| Toggle `ON`/`OFF` | Copy técnico | “Activado” / “Desactivado” |
| Filtro fuente con enums FIRMS crudos | Sin capa de presentación | `sourceProductDisplayName` |
| KPIs mezclaban periodo y filtros | Summary solo por ventana | KPIs de periodo + contador filtrado separado |
| Tabla sin nombre legible | Solo departamento | `buildThermalEventDisplayName` |
| Labels “Pipeline operativo” | Copy técnico en inglés | Estados en español canónicos |

---

## 3. Causa exacta del contador incorrecto

```
visibleResultCount = eventsQuery.pagination.total   // backend, filtros aplicados
currentPageItemCount = items.length                 // página actual
```

**Bug:** `useFireEvents` usaba `placeholderData: (prev) => prev`. Al cambiar filtros, React Query conservaba items de la consulta anterior mientras `pagination.total` ya reflejaba la nueva consulta (a menudo 0). El panel mostraba 0 resultados con filas visibles, o viceversa.

**Solución:** eliminar placeholder cross-query; durante `isPlaceholderData && isFetching`, no renderizar filas stale (`currentPageItemCount = 0`).

---

## 4. Estado único del proceso de datos

Función: `resolveThermalDataStatus` (`src/modules/fires/utils/thermal-data-status.ts`)

| Estado UI | Condición |
| --------- | --------- |
| Datos actualizados | Ingesta OK, pipeline sano, no stale |
| Datos parcialmente actualizados | `is_partial` o proveedores con fallo |
| Datos retrasados | `is_stale` o pipeline unhealthy/stale |
| Proceso con fallos | `alert_level === critical` o ingesta fallida sin datos |
| Sin datos recientes | Sin observaciones ni corrida exitosa |

Presentación: un badge + explicación + línea de proveedores FIRMS + última/próxima actualización (solo si `next_run_at` es real).

---

## 5. Semántica canónica (Phase 1)

| Nivel | Significado | KPI |
| ----- | ----------- | --- |
| Observación recibida | Registro bruto descargado de FIRMS | Observaciones recibidas |
| Detección nacional | Punto válido dentro de Guatemala | Detecciones nacionales |
| Evento térmico | Cluster espacio-temporal | Eventos térmicos agrupados |

Limitación: *Una detección térmica no confirma por sí sola la existencia de un incendio.*

---

## 6. Contrato real del evento térmico (extraído del repositorio)

Basado en `FireEventListItemDto` y `FireEventDetailDto` (`src/modules/fires/types/fire.dto.ts`):

```ts
interface CurrentThermalEventContract {
  // Identidad
  id: string

  // Geometría (acoplada a Point / buffer / hull)
  centroid_lat: number | null
  centroid_lng: number | null
  geometry_method: 'single_detection_buffer' | 'convex_hull_buffer' | null

  // Temporal
  first_detected_at: string
  last_detected_at: string
  persistence_hours: number | null
  created_at: string

  // Evidencia térmica (FIRMS-specific)
  detection_count: number
  satellite_count: number
  source_products: string[]
  max_frp_mw: number | null

  // Clasificación producto
  status: 'new' | 'active' | 'monitoring' | 'closed'
  validation_status: 'no_validado' | 'probable' | 'confirmado'
  risk_level: 'informativo' | 'observacion' | 'atencion' | 'alto' | 'critico'
  priority_score: number

  // Territorio
  department_code: string | null
  department_name: string | null
  cross_department: boolean

  // Detalle ampliado (FireEventDetailDto)
  detections: FireEventDetectionDto[]
  evidence_summary: string
  interpretation: string
  estimated_area_ha: number | null
  protected_area_context: ProtectedAreaContextDto | null
  land_cover_context: LandCoverContextDto | null
  population_context: PopulationContextDto | null
  climate_context: ClimateContextDto | null
  biodiversity_context: BiodiversityContextDto | null
}
```

### Clasificación de campos

| Campo | Clasificación |
| ----- | ------------- |
| id, timestamps, department_* | generic_reusable |
| detection_count, satellite_count, max_frp_mw, source_products | firms_specific / thermal_specific |
| geometry_method, centroid_* | point_geometry_assumption |
| validation_status, risk_level, priority_score | generic_reusable (con adapters) |
| interpretation, evidence_summary | thermal_specific (presentation) |
| land_cover_*, population_*, climate_*, biodiversity_* | requires_adapter (enrichment por tipo de evento) |

---

## 7. Inventario backend — acoplamientos

| Acoplamiento | Archivo | Uso | Generalizable | Estrategia futura |
| ------------ | ------- | --- | ------------- | ----------------- |
| `fire_events` table | `supabase/migrations/001_fire_schema_postgis.sql` | Event store | No directo | `environmental_events` + type discriminator |
| `fire_detections` | idem | Raw points | Parcial | `observations` genérico + adapter FIRMS |
| `fire_ingestion_runs` | idem | Ingest audit | Parcial | `observation_ingestion_runs` |
| `fire_pipeline_runs` | `005_fire_pipeline_scheduler.sql` | Orchestration | Parcial | `event_pipeline_runs` por tipo |
| `/api/environment/fires/*` | `server/routes/fires.ts` | HTTP API | No | `/api/environment/events/:type/*` |
| `getFireSummary` | `server/services/fire-summary.service.ts` | KPIs | thermal_specific | Summary por EventTypeDefinition |
| `listFireEvents` | `server/services/fire-events.service.ts` | List + count | Parcial | Generic list + thermal filter profile |
| `getFireEventDetail` | `server/services/fire-event-detail.service.ts` | Detail + enrichments | requires_adapter | EventDetailLoader registry |
| FIRMS ingest | `src/pipeline/engines/fire/ingest.engine.ts` | Download CSV | firms_specific | `FIRMSAdapter implements ObservationSourceAdapter` |
| Cluster pipeline | `src/pipeline/engines/fire/cluster.pipeline.ts` | Point clustering | point_geometry_assumption | `ThermalEventDetector` plugin |
| `entity_type: fire_event` | findings/priorities/incidents migrations | Intelligence graph | generic_reusable | `entity_type: environmental_event` |
| `getPriorityForFireEvent` | `server/services/priorities.service.ts` | Priority API | safe_to_extract | `getPriorityForEvent(type, id)` |
| Executive metrics `fire_events` | `executive-metrics.service.ts` | National KPIs | thermal_specific | Metric registry por hazard type |

---

## 8. Inventario frontend — acoplamientos

| Componente | Clasificación | Estrategia futura |
| ---------- | ------------- | ----------------- |
| `FireAnalysisPage` | thermal_specific | `EnvironmentalEventPage` + thermal plugin |
| `FireSummaryStrip` | reutilizable con props genéricas | `EventSummaryStrip` |
| `FireFilters` | reutilizable con props genéricas | `EventFilters` + filter registry |
| `FireEventsTable` | thermal_specific | `EventListTable` + column registry |
| `FireEventsMap` | point_geometry_assumption | `PointEventMapRenderer` vs polygon renderer (inundaciones) |
| `FireMapLegend` | thermal_specific | `EventMapLegend` per type |
| `FireEventDetailPanel` | thermal_specific | `EventDetailPanel` + section registry |
| `FirePipelineStatusLine` | firms_specific | `EventDataStatusLine` |
| `ThermalDataStatusLine` | thermal_specific (mejorado) | Generalizar con `DataStatusResolver` |
| `fire-interpretation.ts` | fire_language_coupling | `ThermalPresentationAdapter` |
| `thermal-labels.ts` | safe_to_extract | Base para adapters de copy |
| `source-labels.ts` | firms_specific | `ObservationSourcePresentation` |
| `useFireEvents` / `useFireSummary` | thermal_specific | `useEnvironmentalEvents(type)` |
| `FireEventPriorityCard` | reutilizable con props | Generic priority card |
| `FireLifecycleSection` | reutilizable con profile | Lifecycle profile per event type |
| `FireRelatedFindings` | reutilizable | Generic findings list |

---

## 9. Mapa — dependencias explícitas

| Dependencia | Ubicación | Notas |
| ----------- | --------- | ----- |
| GeoJSON Point detections | `FireEventsMap`, `getFireDetectionsGeoJson` | Circle markers, radio fijo |
| Event geometry (buffer/hull) | `fire-geojson.service.ts` | Polígonos derivados de puntos |
| Clustering Leaflet | `FireEventsMap` centroids | Priority markers en centroide |
| FRP en popup detección | Popup HTML | Campo térmico; no aplica a inundaciones |
| FIRMS source labels | `source-labels.ts` | Satélites VIIRS/MODIS |
| Max 100 features geojson | `server/routes/fires.ts` | Límite hardcoded |

**Conclusión:** el renderer actual es `PointEventMapRenderer` implícito. Inundaciones requerirá `PolygonEventMapRenderer` separado.

---

## 10. Propuesta concreta para Environmental Event Framework (sin implementar)

Basada en código existente:

```
FIRMSAdapter (firms.connector + ingest.engine)
  → ThermalObservation (fire_detections row)
  → ThermalEventDetector (cluster.pipeline)
  → EnvironmentalEvent { type: 'thermal_activity', ...FireEventListItemDto fields }
  → ThermalPresentationAdapter (thermal-labels + fire-interpretation)
  → PointEventMapRenderer (FireEventsMap)
  → FindingRule (fire-finding-profile)
  → PriorityFactorProvider (fire-priority-profile)
```

### Contratos propuestos

| Contrato | Mapeo térmico actual |
| -------- | -------------------- |
| `EnvironmentalEvent` | `FireEventListItemDto` + enrichments |
| `EventTypeDefinition` | `fire.constants.ts` + cluster.config |
| `ObservationSourceAdapter` | `firms.connector` + `ingest.engine` |
| `EventDetector` | `cluster.pipeline` |
| `EventPresentationAdapter` | `thermal-labels`, `fire-interpretation` |
| `EventMapRenderer` | `FireEventsMap` |
| `FindingRule` | `fire-finding-profile` |
| `PriorityFactorProvider` | `fire-priority-profile` |

---

## 11. Resultados preservados (parity)

Este bloque **no modifica**:

- Conteos canónicos en backend (`observations_downloaded`, `detections_count`, `events_count`).
- Clustering, lifecycle, confidence, ventanas temporales.
- Finding Priority Engine ni evaluaciones existentes.
- Rutas API ni esquema DB.

Tests de parity: `thermal-language.test.ts`, `thermal-module-audit.ts`, mappers existentes.

---

## 12. Componentes modificados en este bloque

- `FireAnalysisPage.tsx` — header, estado único, contador, disclaimer
- `FireSummaryStrip.tsx` — KPIs observación/detección/evento
- `FireFilters.tsx` — fuentes en español, pluralización
- `FireEventsTable.tsx` — nombres determinísticos, columnas
- `FireEventDetailPanel.tsx` — título, metodología, copy
- `FireEventsMap.tsx` — popups en español, nombres legibles
- `FireHeatSummaryCard.tsx` — CTA actividad térmica
- `FirePipelineStatusLine.tsx` — delega a `resolveThermalDataStatus`
- `useFireEvents.ts` — sin placeholder stale
- **Nuevos:** `thermal-labels.ts`, `thermal-data-status.ts`, `thermal-result-count.ts`, `thermal-event-display.ts`, `ThermalDataStatusLine.tsx`

---

## 13. Tests y auditorías

| Artefacto | Propósito |
| --------- | --------- |
| `thermal-language.test.ts` | Español, lifecycle, nombres, parity mapper |
| `thermal-result-count.test.ts` | Contador coherente |
| `thermal-data-status.test.ts` | Estado único |
| `fire-pipeline-status.test.ts` | Adapter legacy |
| `npm run thermal-module:audit` | Gate automatizado |

---

## 14. Riesgos y pendientes aceptados

| Pendiente | Motivo |
| --------- | ------ |
| Ruta `/incendios` sin renombrar | Evitar breaking URLs; nav ya dice “Actividad térmica” |
| Tablas `fire_*` sin migrar | Framework futuro; fuera de alcance |
| GeoJSON límite 100 | Comportamiento existente; documentado |
| Lifecycle labels duplicados (`lifecycle-labels` vs `thermalLifecycleLabel`) | Consolidar en framework |
| Detalle: CTAs “Próximamente” | Sin cambio funcional en este bloque |
| Filtros lifecycle/confianza/persistencia en URL | Parcial; ampliar con registry |
| `FireHeatSummaryCard` aún usa `FirePipelineStatusLine` solo con health | Card nacional; consolidar en siguiente paso |

---

## 15. Clasificación por pieza (resumen)

| Pieza | Etiqueta |
| ----- | -------- |
| `thermal-labels.ts` | safe_to_extract |
| `computeThermalResultCounts` | generic_reusable |
| `resolveThermalDataStatus` | requires_adapter |
| `firms.connector` | firms_specific |
| `cluster.pipeline` | point_geometry_assumption + thermal_specific |
| `FireEventsMap` | point_geometry_assumption |
| `fire-interpretation` | fire_language_coupling |
| `entity_type fire_event` en intelligence | generic_reusable |
| Executive `fire_events` metric | thermal_specific |

---

*Documento generado como gate previo al Environmental Event Framework — Multi-Hazard Foundation.*
