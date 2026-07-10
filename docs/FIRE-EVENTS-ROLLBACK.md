# Rollback eventos térmicos (Commit 4)

**No ejecutar en flujo normal.**

```sql
-- Eliminar vínculos y eventos no confirmados
DELETE FROM public.fire_event_detections
WHERE event_id IN (
  SELECT id FROM public.fire_events WHERE validation_status <> 'confirmado'
);

DELETE FROM public.fire_events WHERE validation_status <> 'confirmado';

-- Opcional: eliminar todo
-- DELETE FROM public.fire_event_detections;
-- DELETE FROM public.fire_events;

DROP FUNCTION IF EXISTS public.compute_event_geometry(uuid[], double precision);
DROP FUNCTION IF EXISTS public.fire_detection_neighbor_pairs(uuid[], double precision, double precision);
DROP TRIGGER IF EXISTS fire_events_sync_centroid_trg ON public.fire_events;
DROP FUNCTION IF EXISTS public.fire_events_sync_centroid();

ALTER TABLE public.fire_event_detections
  DROP CONSTRAINT IF EXISTS fire_event_detections_detection_unique;
```
