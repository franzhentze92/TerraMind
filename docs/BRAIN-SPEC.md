# TerraMind Brain Specification

**Versión:** 1.0  
**Clasificación:** Propiedad intelectual fundacional  
**Estado:** Especificación técnica del cerebro — no implementación

---

## Prefacio

Este documento es la **especificación técnica del cerebro de TerraMind**.

No describe pantallas. No describe APIs. No describe código de producción.

Describe **cómo piensa el sistema** — el Reasoning Framework que convierte observaciones en hallazgos, hallazgos en estrategias, y estrategias en reportes ejecutivos.

Este documento, junto con la Ontology, constituye la **propiedad intelectual** de la empresa. Todo lo demás (React, Tailwind, OpenAI) es reemplazable. Esto no.

---

## Índice de documentos del cerebro

| Documento | Contenido | Código |
|-----------|-----------|--------|
| [ONTOLOGY.md](./ONTOLOGY.md) | Qué existe en el mundo | `src/ontology/` |
| [REASONING-FRAMEWORK.md](./REASONING-FRAMEWORK.md) | Cómo piensa el sistema | `src/engine/reasoning/` |
| [EVIDENCE-GRAPH.md](./EVIDENCE-GRAPH.md) | Grafo de trazabilidad | `src/engine/evidence-graph/` |
| [CONFIDENCE-SYSTEM.md](./CONFIDENCE-SYSTEM.md) | Cómo se calcula la confianza | `src/engine/confidence/` |
| [HYPOTHESIS-LIBRARY.md](./HYPOTHESIS-LIBRARY.md) | Biblioteca de hipótesis | `src/engine/libraries/` |
| [STRATEGY-LIBRARY.md](./STRATEGY-LIBRARY.md) | Biblioteca de estrategias | `src/engine/libraries/` |
| [KNOWLEDGE-PACK.md](./KNOWLEDGE-PACK.md) | Conocimiento estructurado | `src/engine/knowledge-pack/` |
| [ANALYST-MANUAL.md](./ANALYST-MANUAL.md) | Personalidad científica | — |

---

## 1. Arquitectura del cerebro

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TERRAMIND BRAIN                               │
├─────────────────────────────────────────────────────────────────────┤
│  KNOWLEDGE LAYER                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Variable     │  │ Hypothesis   │  │ Strategy     │              │
│  │ Catalog      │  │ Library      │  │ Library      │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │ Rule Book    │  │ Knowledge    │                                 │
│  │              │  │ Packs        │                                 │
│  └──────────────┘  └──────────────┘                                 │
├─────────────────────────────────────────────────────────────────────┤
│  REASONING ENGINE (12 etapas modulares)                             │
│  Observar → Validar → Correlacionar → Hipótesis →                  │
│  Evidencia+ → Evidencia- → Confianza → Priorizar →                 │
│  Escenarios → Estrategias → Reporte                                 │
├─────────────────────────────────────────────────────────────────────┤
│  EVIDENCE GRAPH                                                      │
│  Grafo dirigido acíclico que conecta cada conclusión a su origen    │
├─────────────────────────────────────────────────────────────────────┤
│  CONFIDENCE SYSTEM                                                   │
│  Cálculo determinístico multi-factor con explicación                │
├─────────────────────────────────────────────────────────────────────┤
│  ONTOLOGY (entidades del mundo)                                     │
│  Territorio → Observación → Evento → Hallazgo → Expediente         │
├─────────────────────────────────────────────────────────────────────┤
│  DATA ENGINE (ingesta — Equipo 2)                                   │
│  Download → Parse → Normalize → Validate → Store                    │
├─────────────────────────────────────────────────────────────────────┤
│  AI LAYER (Fase 4 — solo lenguaje)                                  │
│  Recibe Hallazgo + Expediente → produce texto ejecutivo             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Principios del cerebro

### 2.1 Determinismo antes que probabilidad

El cerebro es determinístico. Dados los mismos inputs, produce los mismos outputs. La IA es la única capa no-determinística, y está aislada al final.

### 2.2 Cada etapa es reemplazable

Cada etapa del Reasoning Pipeline implementa un contrato (`ReasoningStage<I, O>`). Se puede reemplazar la implementación sin afectar las demás etapas.

### 2.3 Cada etapa es testeable

Cada etapa recibe input tipado y produce output tipado. Se testea con fixtures, no con APIs.

### 2.4 Trazabilidad total

Toda conclusión tiene un camino en el Evidence Graph desde la fuente original hasta el Hallazgo.

### 2.5 La IA nunca razona

La IA traduce. El razonamiento es del motor determinístico + bibliotecas de conocimiento.

### 2.6 "No sé" es output válido

Si la confianza es insuficiente, el cerebro lo declara explícitamente. Nunca improvisa.

---

## 3. Reasoning Pipeline — resumen

Ver [REASONING-FRAMEWORK.md](./REASONING-FRAMEWORK.md) para especificación completa.

```
1.  OBSERVAR          Recopilar observaciones del período
2.  VALIDAR           Filtrar por calidad, frescura, cobertura
3.  CORRELACIONAR     Detectar eventos y patrones multi-fuente
4.  GENERAR HIPÓTESIS Consultar Biblioteca de Hipótesis
5.  EVIDENCIA A FAVOR Buscar observaciones que respaldan
6.  EVIDENCIA EN CONTRA Buscar observaciones que contradicen
7.  CALCULAR CONFIANZA Aplicar Confidence System
8.  PRIORIZAR         Aplicar Priority Engine
9.  GENERAR ESCENARIOS Proyectar tendencias si continúa
10. PROPONER ESTRATEGIAS Consultar Biblioteca de Estrategias
11. GENERAR REPORTE   Compilar las 5 preguntas estratégicas
12. NARRAR (IA)       Traducir a lenguaje ejecutivo [Fase 4]
```

---

## 4. Evidence Graph — resumen

Ver [EVIDENCE-GRAPH.md](./EVIDENCE-GRAPH.md).

```
Fuente → Observación → Evento → Hallazgo → Hipótesis
                                    ↓           ↓
                               Expediente   Evidencia
                                    ↓
                              Estrategia → Reporte
```

Cada nodo es un vértice. Cada relación es una arista tipada con metadata (timestamp, peso, confianza).

---

## 5. Confidence System — resumen

Ver [CONFIDENCE-SYSTEM.md](./CONFIDENCE-SYSTEM.md).

```
Confianza = f(
  fuentes_independientes,    peso: 25%
  coherencia_temporal,       peso: 15%
  coherencia_espacial,       peso: 10%
  ratio_evidencia,           peso: 25%
  calidad_observaciones,     peso: 10%
  corroboración_hipótesis,   peso: 15%
)
```

Cada factor produce una explicación legible:
> "Confianza 91% porque Sentinel coincide, ERA5 coincide, CHIRPS coincide, no existe evidencia contradictoria."

---

## 6. Bibliotecas de conocimiento

### Hypothesis Library
Conocimiento experto sobre causas posibles. Ver [HYPOTHESIS-LIBRARY.md](./HYPOTHESIS-LIBRARY.md).

### Strategy Library
Conocimiento experto sobre respuestas posibles. Ver [STRATEGY-LIBRARY.md](./STRATEGY-LIBRARY.md).

### Knowledge Packs
Dominios de conocimiento estructurado. Ver [KNOWLEDGE-PACK.md](./KNOWLEDGE-PACK.md).

---

## 7. Contrato de etapa (`ReasoningStage`)

Toda etapa del motor implementa:

```typescript
interface ReasoningStage<TInput, TOutput> {
  readonly id: string
  readonly name: string
  readonly version: string

  execute(input: TInput, context: ReasoningContext): Promise<StageResult<TOutput>>

  validate(input: TInput): ValidationResult
}

interface StageResult<T> {
  output: T
  metadata: {
    durationMs: number
    entitiesProcessed: number
    warnings: string[]
    graphNodesAdded: GraphNode[]
    graphEdgesAdded: GraphEdge[]
  }
}

interface ReasoningContext {
  territorioId: string
  ventana: { inicio: string; fin: string }
  graph: EvidenceGraph
  knowledgePacks: KnowledgePackRef[]
  analystRules: AnalystRuleRef
}
```

---

## 8. Mapa de propiedad intelectual

| Activo | Tipo | Copiable por competidor |
|--------|------|------------------------|
| Ontology | Modelo del mundo | Difícil — requiere años de diseño |
| Reasoning Framework | Proceso de pensamiento | Muy difícil |
| Evidence Graph | Trazabilidad | Difícil |
| Hypothesis Library | Conocimiento experto | Imposible sin el dominio |
| Strategy Library | Conocimiento experto | Imposible sin el dominio |
| Confidence System | Metodología | Difícil |
| Knowledge Packs | Conocimiento sectorial | Imposible sin expertos |
| Rule Book | Conocimiento experto | Difícil |
| Analyst Manual | Metodología | Difícil |
| Variable Catalog | Vocabulario semántico | Moderado |
| Frontend (React) | UI | Trivial |
| OpenAI integration | API call | Trivial |

---

## 9. Orden de implementación

| Fase | Qué | Depende de |
|------|-----|------------|
| ✅ 0 | Ontology + Brain Spec | — |
| 1 | Data Engine + Observation Store | Ontology |
| 2 | Etapas 1-3 (Observar, Validar, Correlacionar) | Data Engine |
| 3 | Evidence Graph | Etapas 1-3 |
| 4 | Etapas 4-7 (Hipótesis, Evidencia, Confianza) | Graph + Libraries |
| 5 | Etapas 8-11 (Priorizar, Escenarios, Estrategias, Reporte) | Etapas 4-7 |
| 6 | AI Layer (Narrar) | Todo lo anterior |
| 7 | UI conectada a cerebro real | Fase 5+ |

---

## 10. Criterios de éxito del cerebro

El cerebro funciona cuando:

1. **Una Observación de OpenMeteo entra** y se almacena normalizada
2. **Un Evento se detecta** por regla del Rule Book
3. **Un Hallazgo se crea** con Expediente automático
4. **Una Hipótesis se genera** de la Biblioteca
5. **La confianza se calcula** con explicación legible
6. **Una Estrategia se propone** de la Biblioteca
7. **El Evidence Graph** conecta todo trazablemente
8. **Las 5 preguntas** se responden consultando Hallazgos
9. **"¿Por qué dijiste eso?"** tiene respuesta en el Expediente
10. **La IA solo traduce** — nunca decide

---

## Apéndice: Ejemplo completo de razonamiento

**Input:** Observaciones del 9 de julio 2026, Guatemala

```
OpenMeteo:  temperatura = 36.2°C (anomalía +3.1°C)
CHIRPS:     rainfall_anomaly = -42% (30 días)
Sentinel:   ndvi = 0.38 (caída -14% en 16 días)
NASA FIRMS: fire_count = 3 (Petén)
```

**Paso 1 — OBSERVAR:** 4 observaciones recibidas, 4 fuentes.

**Paso 2 — VALIDAR:** 4/4 pasan validación de calidad.

**Paso 3 — CORRELACIONAR:**
- Evento: `ndvi_drop` (severidad: significativa)
- Evento: `rainfall_deficit` (severidad: significativa)
- Evento: `temp_anomaly` (severidad: significativa)
- Evento: `fire_detected` (severidad: moderada)
- Regla R-COR-001 dispara → Hallazgo candidato

**Paso 4 — GENERAR HIPÓTESIS:**
- Biblioteca consulta condiciones
- HIP-001 "Estrés hídrico" → condiciones cumplidas (lluvia↓, temp↑, NDVI↓)
- HIP-003 "Incendio" → condiciones parcialmente cumplidas (FIRMS↑, temp↑)

**Paso 5 — EVIDENCIA A FAVOR (HIP-001):**
- CHIRPS: rainfall_anomaly = -42% ✓
- ERA5: temperature_anomaly = +3.1°C ✓
- Sentinel: ndvi drop -14% ✓

**Paso 6 — EVIDENCIA EN CONTRA (HIP-001):**
- Ninguna encontrada

**Paso 7 — CALCULAR CONFIANZA:**
```
Fuentes independientes: 3/3 → 25/25
Coherencia temporal: todas en ventana 30d → 15/15
Coherencia espacial: mismo corredor → 10/10
Ratio evidencia: 3 a favor, 0 en contra → 25/25
Calidad observaciones: promedio 92% → 9/10
Corroboración hipótesis: HIP-001 confirmada → 15/15
─────────────────────────────────
CONFIANZA TOTAL: 91%
```

**Paso 8 — PRIORIZAR:**
- Impacto: alto (corredor seco, 8 departamentos)
- Urgencia: alta (tendencia empeorando)
- Score: 87 → Prioridad ALTA

**Paso 9 — ESCENARIOS:**
- Si continúa: expansión del déficit hacia regiones agrícolas del sur (30 días)
- Escenario crítico: pérdida de ciclo agrícola en zona central

**Paso 10 — ESTRATEGIAS:**
- Biblioteca consulta HIP-001
- Conservadora: "Monitorear intensivamente cada 24h"
- Balanceada: "Validar en campo + activar protocolo de sequía"
- Intensiva: "Despachar equipo + solicitar declaratoria de emergencia"

**Paso 11 — REPORTE:**
- Las 5 preguntas respondidas con este Hallazgo como principal

**Paso 12 — NARRAR (Fase 4):**
- OpenAI recibe el Hallazgo + Expediente estructurado
- Produce: "Se detectó un deterioro acelerado del corredor seco..."

---

*Brain Specification v1.0 — La propiedad intelectual de TerraMind.*
