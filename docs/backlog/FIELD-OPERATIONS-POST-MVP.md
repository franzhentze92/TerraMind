# Field Operations — Post-MVP Backlog

**Estado:** diferido — no implementar hasta nueva decisión de producto  
**Cierre MVP:** `9aa1e19` — 8B.7G Controlled Real Field Sync Pilot  
**Fecha registro:** 2026-07-10

Field Operations alcanzó el criterio **functionally complete and validated end-to-end** en 8B.7. Los ítems siguientes son expansión operacional/comercial, no requisitos del MVP.

---

## Contexto del MVP cerrado (8B.7)

Capacidades entregadas y validadas:

- Offline mission packages
- Field form runtime
- Offline evidence capture
- Synchronization engine (mock + piloto real allowlisted)
- Mobile PWA (`/campo`)
- Authentication + authorization + tenant isolation
- Provisioning (migraciones 028/029/030)
- Piloto real 8B.7G con submission en `ready_for_validation`
- `FIELD_REAL_SYNC_ENABLED = false` (global)
- Allowlist piloto desactivada en entorno local

**No reabrir** estos bloques salvo bug de seguridad, pérdida de datos o regresión de sync/idempotencia.

---

## Backlog — 8B.7H Internal Field Sync Rollout (diferido)

### Objetivo original

Pasar de una misión piloto a rollout interno controlado para un grupo pequeño de usuarios TerraMind.

### Alcance planeado (no implementado)

| Área | Descripción |
|------|-------------|
| **Rollout policy versionada** | `InternalFieldSyncRolloutPolicy` con org/user/role/mission tags, límites y kill switch |
| **Policy unificada pilot-or-rollout** | Evaluador que combine 8B.7G pilot allowlist con rollout |
| **Límites diarios** | Bundles/día, bytes/día, concurrencia de uploads, tamaño máximo de asset |
| **Kill switch administrativo** | Bloqueo inmediato de nuevas sesiones sin borrar evidencia local |
| **Allowlist dinámica** | Usuarios internos aprobados más allá de env estático |
| **Métricas de rollout** | Bundles intentados/exitosos/fallidos, bytes, retries, checksum failures, auth failures |
| **Alertas** | Error rate alto, uploads huérfanos, cola de validación atrasada, kill switch activo |
| **Dashboard admin** | UI platform-admin: activar/pausar, allowlist, límites, consumo, errores |
| **Migración DB** | `031_field_sync_rollout.sql` — runtime, allowlist, daily usage, metrics, alerts |
| **Diagnóstico por sync** | Vista operacional por bundle/submission sin exponer secretos ni signed URLs |
| **Configuración comercial** | Despliegue general, multi-org rollout, monitoreo de producción |

### Criterio para retomar

- Decisión explícita de producto para habilitar sync real más allá del piloto
- Migración 031 aplicada en entorno de staging
- Runbook de rollback y soporte operacional
- Métricas baseline del piloto 8B.7G como referencia

### Notas de implementación abortada (2026-07-10)

Se inició trabajo local en 8B.7H y se **descartó antes de commit/push**. No existe en `origin/main`. Migración 031 **no fue aplicada** en Supabase.

---

## Backlog — mejoras Field Ops menores (diferido)

| Ítem | Prioridad | Notas |
|------|-----------|-------|
| Sync global `FIELD_REAL_SYNC_ENABLED=true` | Baja | Solo tras rollout interno estable |
| UI sync para usuarios no piloto | Baja | Depende de rollout |
| Polling offline package job en CLI piloto | Muy baja | Operacional interno |
| Segunda misión piloto duplicada en remote | Muy baja | Cleanup ops, no bloqueante |

---

## Qué NO expandir prematuramente

- Rollout multi-organización
- Límites y billing por uso
- Alertas y paging on-call
- Admin UI de sync fuera de platform-admin
- Habilitación pública de sync real
- Métricas duplicadas en cliente y servidor sin idempotency keys

---

## Referencias

- Reporte piloto: `docs/reports/8B7G-controlled-real-sync-pilot.md`
- Activación auth: `docs/ACTIVATION-8B7F4.md`
- Policy piloto (en repo): `src/core/field-sync/real-sync-pilot-policy.ts`
