# TerraMind Reasoning Framework

**Versión:** 1.0  
**Rol:** ADN del sistema — cómo piensa TerraMind  
**Principio:** Proceso determinístico, no improvisación

---

## 1. El pipeline completo

```
┌──────────┐   ┌──────────┐   ┌──────────────┐   ┌───────────────┐
│ OBSERVAR │──→│ VALIDAR  │──→│ CORRELACIONAR│──→│   HIPÓTESIS   │
└──────────┘   └──────────┘   └──────────────┘   └───────┬───────┘
                                                          │
┌──────────┐   ┌──────────┐   ┌──────────────┐          │
│ REPORTE  │←──│ESTRATEGIA│←──│  ESCENARIOS  │←─────────┤
└──────────┘   └──────────┘   └──────────────┘          │
     ↑              ↑              ↑                       │
     │         ┌──────────┐   ┌──────────┐   ┌──────────┴────────┐
     │         │PRIORIZAR │←──│ CONFIANZA│←──│ EVIDENCIA+ / EVID- │
     │         └──────────┘   └──────────┘   └───────────────────┘
     │
┌────┴─────┐
│ NARRAR   │  [Fase 4 — solo IA]
└──────────┘
```

---

## 2. Especificación por etapa

### Etapa 1: OBSERVAR

| Campo | Valor |
|-------|-------|
| ID | `observe` |
| Módulo | `ObserveStage` |
| Input | `{ territorioId, ventana, fuenteIds? }` |
| Output | `{ observaciones: Observacion[], fuentesActivas: number }` |
| Depende de | Data Engine (Observation Store) |
| Usa IA | No |

**Qué hace:**
1. Consulta Observation Store por territorio y ventana temporal
2. Agrupa por fuente y variable
3. Registra nodos en Evidence Graph

**Qué NO hace:**
- No interpreta los datos
- No filtra por relevancia (eso es Validar)
- No detecta anomalías (eso es Correlacionar)

---

### Etapa 2: VALIDAR

| Campo | Valor |
|-------|-------|
| ID | `validate` |
| Módulo | `ValidateStage` |
| Input | `{ observaciones: Observacion[] }` |
| Output | `{ validas: Observacion[], rechazadas: RejectedObservation[], cobertura: CoverageReport }` |
| Depende de | Variable Catalog (rangos normales) |
| Usa IA | No |

**Criterios de validación:**

| Criterio | Acción si falla |
|----------|-----------------|
| Calidad < 50 | Rechazar |
| Flag `stale` (> 7 días sin actualizar) | Rechazar para detección, mantener para histórico |
| Flag `cloud_cover_high` | Rechazar para variables satelitales |
| Valor fuera de rango físico posible | Rechazar |
| Duplicado (mismo ID determinístico) | Ignorar (idempotencia) |
| Fuente no activa en catálogo | Rechazar |

**Output especial — CoverageReport:**
```
{
  fuentesEsperadas: 4,
  fuentesActivas: 3,
  fuentesFaltantes: ["sentinel-2"],
  razon: "Cobertura de nubes > 80% en últimos 5 días",
  impactoEnConfianza: "reducirá coherencia espacial"
}
```

---

### Etapa 3: CORRELACIONAR

| Campo | Valor |
|-------|-------|
| ID | `correlate` |
| Módulo | `CorrelateStage` |
| Input | `{ observaciones: Observacion[], territorioId }` |
| Output | `{ eventos: Evento[], hallazgosCandidatos: HallazgoCandidate[] }` |
| Depende de | Rule Book (reglas de detección y correlación) |
| Usa IA | No |

**Sub-proceso:**

```
Observaciones válidas
    ↓
[Reglas de Detección] → Eventos individuales
    ↓
[Reglas de Correlación] → Agrupación espacial + temporal
    ↓
[Reglas de Inhibición] → Filtrar falsos positivos
    ↓
Hallazgos candidatos (con Expediente draft)
```

**Ejemplo con 4 observaciones:**
```
NDVI↓ + Lluvia↓ + Temp↑ + FIRMS↑
  → 4 eventos detectados
  → R-COR-001 agrupa NDVI↓ + Lluvia↓ + Temp↑ → Hallazgo candidato "Estrés múltiple"
  → R-COR-003 agrupa FIRMS↑ + Temp↑ → Hallazgo candidato "Riesgo de incendio"
```

---

### Etapa 4: GENERAR HIPÓTESIS

| Campo | Valor |
|-------|-------|
| ID | `hypothesize` |
| Módulo | `HypothesizeStage` |
| Input | `{ hallazgo: Hallazgo, eventos: Evento[] }` |
| Output | `{ hipotesis: Hipotesis[], hipotesisDescartadas: Hipotesis[] }` |
| Depende de | Hypothesis Library |
| Usa IA | No |

**Proceso:**
1. Para cada Hallazgo, consultar Hypothesis Library
2. Evaluar condiciones de cada hipótesis contra eventos y observaciones
3. Las que cumplen → `propuesta`
4. Las que no cumplen pero son relevantes → `descartada` (con razón)
5. Nunca eliminar — todo queda en el Expediente

---

### Etapa 5: EVIDENCIA A FAVOR

| Campo | Valor |
|-------|-------|
| ID | `evidence-for` |
| Módulo | `EvidenceForStage` |
| Input | `{ hipotesis: Hipotesis, observaciones: Observacion[], eventos: Evento[] }` |
| Output | `{ evidencia: Evidencia[] }` |
| Depende de | Evidence Graph, Variable Catalog |
| Usa IA | No |

**Proceso:**
1. Para cada hipótesis activa, buscar observaciones que respaldan sus condiciones
2. Buscar eventos correlacionados
3. Calcular peso de cada evidencia (0-100)
4. Registrar aristas en Evidence Graph: `Evidencia --respalda--> Hipótesis`

---

### Etapa 6: EVIDENCIA EN CONTRA

| Campo | Valor |
|-------|-------|
| ID | `evidence-against` |
| Módulo | `EvidenceAgainstStage` |
| Input | `{ hipotesis: Hipotesis, observaciones: Observacion[], eventos: Evento[] }` |
| Output | `{ evidencia: Evidencia[], contradicciones: ContradictionReport[] }` |
| Depende de | Hypothesis Library (condiciones de refutación), Analyst Manual |
| Usa IA | No |

**Proceso:**
1. Buscar activamente evidencia que contradice la hipótesis
2. Evaluar condiciones de refutación de la Hypothesis Library
3. Si ratio a_favor:en_contra < 2:1 → marcar contradicción
4. Aplicar Analyst Manual: no confirmar, no generar estrategia

**Ejemplo:**
```
Hipótesis: "Estrés hídrico"
Evidencia a favor: rainfall -42%, ndvi -14%, temp +3.1°C
Evidencia en contra: ninguna
Contradicción: no
```

```
Hipótesis: "Estrés hídrico"
Evidencia a favor: ndvi -14%
Evidencia en contra: rainfall normal (+5%), soil_moisture normal
Contradicción: sí → no confirmar, solicitar más datos
```

---

### Etapa 7: CALCULAR CONFIANZA

| Campo | Valor |
|-------|-------|
| ID | `confidence` |
| Módulo | `ConfidenceStage` |
| Input | `{ hallazgo, hipotesis, evidenciaAFavor, evidenciaEnContra, coverage }` |
| Output | `{ confianza: ConfidenceResult }` |
| Depende de | Confidence System |
| Usa IA | No |

Ver [CONFIDENCE-SYSTEM.md](./CONFIDENCE-SYSTEM.md) para fórmula completa.

**Output incluye explicación legible:**
```typescript
{
  score: 91,
  nivel: 'alta',
  factores: [
    { factor: 'fuentes_independientes', score: 25, max: 25, detalle: 'Sentinel, ERA5, CHIRPS' },
    { factor: 'coherencia_temporal', score: 15, max: 15, detalle: 'Todas en ventana 30d' },
    { factor: 'ratio_evidencia', score: 25, max: 25, detalle: '3 a favor, 0 en contra' },
    ...
  ],
  explicacion: 'Confianza 91% porque Sentinel coincide, ERA5 coincide, CHIRPS coincide, no existe evidencia contradictoria.'
}
```

---

### Etapa 8: PRIORIZAR

| Campo | Valor |
|-------|-------|
| ID | `prioritize` |
| Módulo | `PrioritizeStage` |
| Input | `{ hallazgo, confianza, riesgo? }` |
| Output | `{ prioridad: Prioridad, riesgo: Riesgo }` |
| Depende de | Rule Book (reglas de prioridad), Knowledge Packs |
| Usa IA | No |

**Fórmula:**
```
priority_score = (impacto × 0.4) + (urgencia × 0.35) + (confianza × 0.25)
```

**Solo prioriza Hallazgos con confianza ≥ 30.**

---

### Etapa 9: GENERAR ESCENARIOS

| Campo | Valor |
|-------|-------|
| ID | `scenarios` |
| Módulo | `ScenarioStage` |
| Input | `{ hallazgo, observaciones: SeriesTemporales, hipotesis }` |
| Output | `{ escenarios: Escenario[] }` |
| Depende de | Knowledge Packs (proyecciones por dominio) |
| Usa IA | No |

**Tipos de escenario:**

| Tipo | Descripción |
|------|-------------|
| `continuacion` | Qué pasa si la tendencia continúa |
| `escalacion` | Qué pasa si empeora |
| `recuperacion` | Qué pasa si mejora |
| `punto_inflexion` | Cuándo podría cambiar la tendencia |

**Ejemplo:**
```
Escenario crítico: "Si el déficit pluviométrico continúa 30 días más,
el corredor seco se expandirá hacia regiones agrícolas del sur,
afectando ~120,000 ha adicionales."
Horizonte: 30 días
Confianza: 72%
```

---

### Etapa 10: PROPONER ESTRATEGIAS

| Campo | Valor |
|-------|-------|
| ID | `strategize` |
| Módulo | `StrategizeStage` |
| Input | `{ hallazgo, hipotesisPrincipal, prioridad, escenarios }` |
| Output | `{ estrategias: Estrategia[] }` |
| Depende de | Strategy Library |
| Usa IA | No |

**Solo genera estrategias si:**
- Confianza ≥ 50
- Hipótesis principal en estado `activa` o `confirmada`
- Sin contradicción sin resolver

**Consulta Strategy Library** para obtener 3 niveles: conservadora, balanceada, intensiva.

---

### Etapa 11: GENERAR REPORTE

| Campo | Valor |
|-------|-------|
| ID | `report` |
| Módulo | `ReportStage` |
| Input | `{ territorioId, hallazgos: Hallazgo[], periodo }` |
| Output | `{ reporte: Reporte }` |
| Depende de | Las 5 preguntas estratégicas |
| Usa IA | No (estructura); Sí (texto, Fase 4) |

**Las 5 preguntas son consultas, no prompts:**

| Pregunta | Query |
|----------|-------|
| ¿Qué está pasando? | Hallazgos activos del período |
| ¿Por qué? | Hipótesis confirmadas |
| ¿Qué puede pasar? | Escenarios proyectados |
| ¿Qué merece atención? | Hallazgos por prioridad DESC |
| ¿Qué estrategias? | Estrategias de Hallazgos priorizados |

---

### Etapa 12: NARRAR (Fase 4)

| Campo | Valor |
|-------|-------|
| ID | `narrate` |
| Módulo | `NarrateStage` |
| Input | `{ hallazgo, expediente, reporte }` |
| Output | `{ resumenEjecutivo: string }` |
| Depende de | Analyst Manual (como system prompt) |
| Usa IA | **Sí — única etapa con IA** |

**Input a OpenAI:**
```json
{
  "hallazgo": { ... },
  "expediente": { ... },
  "confianza": { "score": 91, "explicacion": "..." },
  "instruccion": "Traduce a lenguaje ejecutivo. No agregues información que no esté en el expediente."
}
```

---

## 3. Orquestación

```typescript
interface ReasoningOrchestrator {
  run(context: ReasoningContext): Promise<ReasoningResult>
  runStage(stageId: string, input: unknown): Promise<StageResult<unknown>>
  runFromStage(stageId: string, context: ReasoningContext): Promise<ReasoningResult>
}
```

**Modos de ejecución:**

| Modo | Cuándo |
|------|--------|
| `full` | Informe diario — las 12 etapas |
| `incremental` | Nueva observación — desde Correlacionar |
| `reevaluation` | Contradicción detectada — desde Evidencia |
| `single_hallazgo` | Un Hallazgo específico — desde Hipótesis |

---

## 4. Manejo de errores por etapa

| Situación | Comportamiento |
|-----------|---------------|
| Etapa falla | Detener pipeline, registrar en Expediente, no generar conclusiones parciales visibles |
| Datos insuficientes | Etapa produce output vacío + warning, pipeline continúa |
| Contradicción | Pipeline continúa pero marca Hallazgo como `en_investigacion` |
| Confianza < 30 | Pipeline completa pero Hallazgo no es visible al usuario |
| Fuente caída | CoverageReport refleja ausencia, confianza se reduce |

---

## 5. Testabilidad

Cada etapa se testea con fixtures:

```
fixtures/
├── observations/
│   ├── stress_scenario.json      # NDVI↓ + Lluvia↓ + Temp↑
│   ├── fire_scenario.json        # FIRMS↑ + Temp↑
│   └── normal_scenario.json      # Todo normal
├── expected/
│   ├── stress_events.json
│   ├── stress_hallazgo.json
│   └── stress_confidence.json
```

Test: `CorrelateStage.execute(stress_observations) → expected_events`

---

*Reasoning Framework v1.0 — El ADN de TerraMind.*
