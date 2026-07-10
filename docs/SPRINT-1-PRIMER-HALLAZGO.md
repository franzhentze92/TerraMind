# Sprint 1 — Primer Hallazgo Automático

**No es una integración de NASA FIRMS.**  
Es la validación del modelo completo de TerraMind con una única fuente real.

---

## Objetivo

Cuando TerraMind ejecute una sincronización, debe transformar datos públicos en inteligencia estructurada — sin intervención humana, sin IA, de forma determinística.

```
NASA FIRMS
    ↓
Descarga datos
    ↓
Normaliza
    ↓
Observation
    ↓
Event
    ↓
Hallazgo
    ↓
Hipótesis
    ↓
Prioridad
    ↓
Estrategia
    ↓
Informe Ejecutivo
    ↓
UI
```

**Criterio de éxito:** Un incendio ocurre en Guatemala y, sin que nadie haga clic, TerraMind lo detecta, analiza, genera un Hallazgo y lo muestra en Situación Nacional.

---

## Arquitectura — Fábrica de Inteligencia

```
           Fuente (NASA FIRMS)
              ↓
       Data Connector
              ↓
      Observation Engine
              ↓
        Event Engine
              ↓
      Hallazgo Engine
              ↓
     Prioritization Engine
              ↓
      Strategy Engine
              ↓
      Situation Report
              ↓
              UI
```

**Regla de oro:** Nunca desarrollar una fuente sin saber qué Hallazgo puede generar.

| Fuente | Hallazgo que habilita |
|--------|----------------------|
| NASA FIRMS | Incendio activo / Riesgo de propagación |
| CHIRPS | Déficit o exceso de precipitación |
| Sentinel-2 | Deterioro o recuperación de vegetación |
| ERA5 / Open-Meteo | Olas de calor, anomalías térmicas |

Sprint 1 solo implementa la primera fila. El patrón es reutilizable.

---

## Flujo de negocio (10 pasos)

1. **Descargar** focos de calor activos desde NASA FIRMS (Guatemala).
2. **Convertir** cada registro en una `Observacion` (`fire_radiative_power`).
3. **Agrupar** observaciones cercanas espacial y temporalmente en un `Evento`.  
   Ejemplo: tres focos dentro de 15 km en 24 h → un evento `fire_cluster`.
4. **Aplicar Rule Engine** determinístico.  
   Si ≥ 3 focos en cluster y FRP supera umbral → candidato a Hallazgo.
5. **Crear Hallazgo** automáticamente.  
   Ejemplo: *"Focos de calor activos en Petén"*.
6. **Asignar** prioridad, confianza, evidencia, hipótesis (HIP-003), riesgo, estrategia (STR-003).
7. **Persistir** Hallazgo + Expediente (1:1).
8. **Actualizar** pantalla Situación Nacional vía API.
9. **Agregar entrada** al Timeline de inteligencia.
10. **Incluir** en el Informe Diario ejecutivo.

**Sin IA.** Todo determinístico. La IA entra en Fase 4 (solo narración).

---

## Scheduler

TerraMind observa solo. No hay botón "Actualizar".

```
Cada hora
    ↓
Consultar NASA FIRMS
    ↓
Ejecutar pipeline completo
    ↓
Persistir + publicar a UI
```

---

## Reglas del sprint

### Detección — R-DET-003 (existente)
`fire_radiative_power > 0` → evento `fire_detected`

### Correlación — R-COR-FIRE (nueva)
`fire_cluster` con ≥ 3 observaciones en 24 h → Hallazgo categoría `incendio`

### Inhibición — excepción Sprint 1
R-INH-001 relajada para hallazgos `incendio`: mínimo 3 observaciones, 1 fuente (FIRMS).

### Hipótesis — HIP-003
Incendio activo con riesgo de propagación

### Estrategia — STR-003-I
Respuesta de emergencia ante incendio activo

---

## Qué NO es este sprint

- ❌ Mapa
- ❌ Gráficos
- ❌ IA conversacional
- ❌ Segunda fuente (Open-Meteo = Sprint 2)
- ❌ Orquestador de 12 etapas completo (solo el slice necesario)

---

## Implementación

| Capa | Ubicación |
|------|-----------|
| Data Connector | `src/pipeline/connectors/firms.connector.ts` |
| Engines | `src/pipeline/engines/` |
| Orchestrator | `src/pipeline/orchestrator.ts` |
| Store | `src/pipeline/stores/file.store.ts` |
| Scheduler | `src/pipeline/scheduler.ts` |
| API | `server/index.ts` |
| UI hooks | `src/modules/national-center/hooks/` |

---

## Roadmap posterior

| Sprint | Fuente | Comportamiento |
|--------|--------|----------------|
| 2 | Open-Meteo | Enriquece hallazgos existentes (correlación) |
| 3 | CHIRPS | Nuevo hallazgo: déficit/exceso precipitación |
| 4 | Sentinel-2 | Nuevo hallazgo: deterioro vegetación |

Cuando un Hallazgo tiene cuatro fuentes, la confianza sube sola.

---

## Momento de verdad

> Hoy ocurrió un incendio en Guatemala y, sin que nadie hiciera clic en nada, TerraMind lo detectó, lo analizó, generó un Hallazgo y lo mostró automáticamente en la pantalla principal.

Ese día deja de ser prototipo.
