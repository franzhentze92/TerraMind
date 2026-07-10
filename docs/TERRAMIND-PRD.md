# TerraMind — Product Requirements Document (PRD)

**Versión:** 0.1  
**Fecha:** Julio 2026  
**Estado:** Constitución del producto  
**Clasificación:** Documento fundacional — no es material de ventas

---

## Prefacio

Este documento es la **constitución de TerraMind**.

No describe una interfaz. No describe un dashboard. No describe un chatbot.

Describe el **motor de inteligencia territorial** que produce hallazgos ejecutivos a partir de evidencia pública, y la plataforma que los presenta.

Cada función, módulo, conector o integración futura debe verificarse contra este documento antes de implementarse. Si una propuesta contradice este PRD, la propuesta está mal — no la constitución.

---

## Tabla de contenidos

1. [Misión y visión](#1-misión-y-visión)
2. [Qué es TerraMind (y qué NO es)](#2-qué-es-terramind-y-qué-no-es)
3. [El átomo: el Hallazgo](#3-el-átomo-el-hallazgo)
4. [El modelo de datos universal](#4-el-modelo-de-datos-universal)
5. [Catálogo de fuentes](#5-catálogo-de-fuentes)
6. [Pipeline de ingestión](#6-pipeline-de-ingestión)
7. [Motor de inteligencia (Reasoning Engine)](#7-motor-de-inteligencia-reasoning-engine)
8. [Sistema de evidencia](#8-sistema-de-evidencia)
9. [Índice de confianza](#9-índice-de-confianza)
10. [Estrategias](#10-estrategias)
11. [Las cinco preguntas estratégicas](#11-las-cinco-preguntas-estratégicas)
12. [Rol de la inteligencia artificial](#12-rol-de-la-inteligencia-artificial)
13. [Arquitectura del sistema](#13-arquitectura-del-sistema)
14. [Territory Intelligence OS](#14-territory-intelligence-os)
15. [Roadmap](#15-roadmap)
16. [Principios de ingeniería](#16-principios-de-ingeniería)
17. [Glosario](#17-glosario)
18. [Decisiones abiertas](#18-decisiones-abiertas)

---

## 1. Misión y visión

### Misión

Construir el primer **motor de inteligencia territorial nacional** que observe continuamente un país utilizando fuentes públicas de información y transforme esa información en **hallazgos ejecutivos respaldados por evidencia**.

### Visión

Que un ministro de gobierno abra TerraMind y sienta que **el país ya fue analizado** antes de que él entrara. No que tiene que hacer una consulta. No que tiene que llenar un formulario. Sino que está entrando a una **sala de situación nacional** donde el sistema ya hizo el trabajo.

### Propuesta de valor

| Para quién | Qué obtienen |
|---|---|
| Tomadores de decisión de alto nivel | Respuestas a las 5 preguntas estratégicas diarias, con evidencia y confianza |
| Analistas gubernamentales | Trazabilidad completa: por qué el sistema dijo lo que dijo |
| Instituciones | Un sistema que nunca inventa indicadores científicos |

### Lo que NO es nuestra misión

- Construir un GIS
- Construir un dashboard tradicional
- Construir un chatbot
- Reemplazar modelos físicos o datos oficiales con IA
- Servir a agricultores de campo (el producto es ejecutivo)

---

## 2. Qué es TerraMind (y qué NO es)

### TerraMind ES

Un **Territory Intelligence OS** — un sistema operativo de inteligencia territorial compuesto por:

1. **Un cerebro** — pipeline de ingestión + motor de razonamiento
2. **Un átomo** — el Hallazgo
3. **Una interfaz** — la plataforma que presenta hallazgos al usuario

La plataforma es la interfaz. El producto es el motor.

### TerraMind NO ES

| Categoría | Por qué no |
|---|---|
| GIS / mapa interactivo | Los mapas son una vista de hallazgos, no el producto |
| Dashboard de sensores | No mostramos datos crudos; mostramos inteligencia |
| Chatbot / Copilot genérico | El Copilot consume hallazgos; no razona desde cero |
| Plataforma de agricultura de precisión | El usuario es el gobierno, no el productor |
| Herramienta de cálculo científico | Los indicadores vienen de modelos físicos y fuentes oficiales |

### Analogías de referencia

| Producto | Qué tomamos |
|---|---|
| Palantir Gotham | Ontología de objetos, sala de situación, evidencia trazable |
| Bloomberg Terminal | Información viva, feed en tiempo real, densidad ejecutiva |
| Perplexity | Respuestas con fuentes citadas |
| Linear | Interfaz limpia, rápida, premium |
| Arc Browser | Elegancia, espacio, tipografía impecable |

---

## 3. El átomo: el Hallazgo

### Definición

El **Hallazgo** (`Finding`) es el átomo de TerraMind.

Todo en el sistema existe para producir, enriquecer, priorizar o presentar Hallazgos.

```
Facebook  → Post
GitHub    → Repository
Salesforce → Account
Palantir  → Ontology Object
TerraMind → Hallazgo
```

No es la Observación. No es el mapa. No es el NDVI. **Todo termina en un Hallazgo.**

### Por qué Hallazgo y no Observation

| Concepto | Rol |
|---|---|
| `Observation` | Unidad atómica de **dato entrante** — lo que captura el pipeline |
| `Hallazgo` | Unidad atómica de **inteligencia saliente** — lo que consume el usuario |

Las observaciones son materia prima. Los hallazgos son el producto.

### Esquema del Hallazgo

```typescript
interface Hallazgo {
  id: string
  titulo: string
  descripcion: string

  // Contexto territorial
  ubicacion: GeoLocation
  territorioId: string
  fechaDeteccion: string
  fechaActualizacion: string

  // Clasificación
  categoria: HallazgoCategory
  prioridad: PriorityLevel
  confianza: ConfidenceScore
  estado: HallazgoStatus

  // Inteligencia
  evidencia: EvidenceBundle
  hipotesis: Hypothesis[]
  hipotesisDescartadas: Hypothesis[]
  variablesRelacionadas: string[]

  // Acción
  estrategias: Strategy[]
  responsable?: string

  // Trazabilidad
  historial: HallazgoEvent[]
  modeloUtilizado?: string
  versionMotor: string
}
```

### Estados de un Hallazgo

| Estado | Significado |
|---|---|
| `detectado` | El motor identificó una señal |
| `en_analisis` | Se están agregando evidencias y generando hipótesis |
| `confirmado` | Múltiples fuentes corroboran el hallazgo |
| `priorizado` | Asignado nivel de prioridad ejecutiva |
| `en_seguimiento` | Monitoreo activo |
| `resuelto` | La situación evolucionó favorablemente |
| `descartado` | Evidencia contradice la hipótesis principal |

### Categorías de Hallazgo

- `climatico` — anomalías térmicas, precipitación, sequía
- `hidrologico` — niveles de agua, déficit hídrico
- `vegetacion` — NDVI, salud vegetal, degradación
- `incendio` — focos de calor, expansión
- `suelo` — erosión, humedad, degradación
- `institucional` — boletines oficiales, alertas
- `socioambiental` — conflictos, desplazamiento
- `compuesto` — hallazgos que cruzan múltiples categorías

### Regla fundamental

> Si una funcionalidad no produce, consume o enriquece un Hallazgo, no pertenece al MVP del motor.

---

## 4. El modelo de datos universal

### Observation — el formato universal de entrada

Todo dato que entra al sistema, sin importar su fuente, se normaliza a una `Observation`:

```typescript
interface Observation {
  id: string
  sourceId: string          // Referencia al conector de origen
  sourceName: string        // "NASA FIRMS", "OpenMeteo", etc.
  timestamp: string         // ISO 8601
  ingestedAt: string        // Cuándo entró al pipeline

  // Qué se observó
  location: GeoLocation
  category: ObservationCategory
  variable: string          // "temperature", "ndvi", "fire_radiative_power"
  value: number | string | boolean
  unit: string              // "°C", "mm", "index", etc.

  // Calidad
  confidence: number        // 0-100, confianza del dato en sí
  qualityFlags: string[]    // "cloud_cover_high", "stale", etc.

  // Geoespacial
  geometry?: GeoGeometry   // Point, Polygon, etc.

  // Trazabilidad
  rawReference: string      // URL, archivo, ID en fuente original
  metadata: Record<string, unknown>
}
```

### GeoLocation

```typescript
interface GeoLocation {
  type: 'point' | 'polygon' | 'region' | 'country'
  coordinates?: [number, number]       // [lon, lat]
  geometry?: GeoGeometry
  regionName?: string
  departmentCode?: string
  countryCode: string
}
```

### Relación Observation → Hallazgo

```
Observations (N)  →  [Motor de Inteligencia]  →  Hallazgo (1)
```

Un Hallazgo se compone de múltiples Observations agregadas, correlacionadas e interpretadas. Nunca al revés.

### Otros tipos del dominio

| Tipo | Rol | Quién lo produce |
|---|---|---|
| `Observation` | Dato normalizado entrante | Pipeline de ingestión |
| `Indicator` | Métrica calculada por modelo físico | Fuentes oficiales / modelos |
| `Evidence` | Observation o Indicator seleccionado para respaldar un Hallazgo | Evidence Aggregator |
| `Hypothesis` | Explicación causal propuesta | Hypothesis Generator |
| `Hallazgo` | Inteligencia ejecutiva | Hallazgo Engine |
| `Strategy` | Recomendación accionable | Strategy Engine |
| `ConfidenceScore` | Nivel de certeza calculado | Confidence Engine |

### Regla: la IA nunca produce Observations ni Indicators

Los indicadores científicos (NDVI, precipitación acumulada, temperatura anómala) provienen de:

1. Modelos físicos (ERA5, CHIRPS)
2. Procesamiento satelital (Sentinel)
3. Datos oficiales (INSIVUMEH, MAGA)

La IA **interpreta, conecta, resume, prioriza y propone**. Nunca calcula.

---

## 5. Catálogo de fuentes

### Estructura de un conector

Cada fuente implementa el contrato `SourceConnector`:

```typescript
interface SourceConnector {
  id: string
  name: string
  type: SourceType
  territory: string[]           // Países soportados

  // Capacidades
  variables: string[]           // Qué variables provee
  temporalResolution: string    // "hourly", "daily", "16-day"
  spatialResolution: string     // "1km", "10m", "point"

  // Pipeline
  download(params: DownloadParams): Promise<RawPayload>
  parse(raw: RawPayload): Promise<ParsedRecord[]>
  normalize(parsed: ParsedRecord[]): Promise<Observation[]>
  validate(observations: Observation[]): Promise<ValidationResult>

  // Estado
  healthCheck(): Promise<SourceHealthStatus>
}
```

### Catálogo inicial

| ID | Fuente | Tipo | Variables | Sprint |
|---|---|---|---|---|
| `openmeteo` | OpenMeteo | Clima | temperatura, precipitación, humedad, viento | 1 |
| `nasa-firms` | NASA FIRMS | Incendios | fire_radiative_power, confidence | 2 |
| `sentinel-2` | Copernicus Sentinel-2 | Satélite | ndvi, ndwi, cloud_cover | 3 |
| `chirps` | CHIRPS | Precipitación | rainfall_accumulation | 4 |
| `era5` | ERA5 (Copernicus) | Clima | temperature_anomaly, precipitation | Futuro |
| `gdelt` | GDELT | Noticias/eventos | event_count, sentiment | Futuro |
| `insivumeh` | INSIVUMEH | Oficial (GT) | boletines, alertas | Futuro |
| `maga` | MAGA | Oficial (GT) | reportes agrícolas | Futuro |
| `marn` | MARN | Oficial (GT) | ambiental | Futuro |
| `soilgrids` | SoilGrids / FAO | Suelo | soil_moisture, organic_carbon | Futuro |

### Regla de conexión

> Una fuente no se considera "conectada" hasta que produce al menos una `Observation` válida en la base de datos. Un health check verde no cuenta.

---

## 6. Pipeline de ingestión

### Flujo

```
API Externa
    ↓
Downloader        — Obtiene datos crudos (HTTP, FTP, API)
    ↓
Parser            — Convierte formato fuente a registros estructurados
    ↓
Normalizer        — Transforma registros a Observation[]
    ↓
Validator         — Verifica integridad, rangos, duplicados
    ↓
Observation Store — Persiste en base de datos
```

### Responsabilidades por etapa

| Etapa | Input | Output | Errores |
|---|---|---|---|
| Downloader | Config + parámetros territoriales | `RawPayload` | Timeout, 429, datos vacíos |
| Parser | `RawPayload` | `ParsedRecord[]` | Formato inesperado, campos faltantes |
| Normalizer | `ParsedRecord[]` | `Observation[]` | Unidades incorrectas, coordenadas inválidas |
| Validator | `Observation[]` | `ValidationResult` | Duplicados, outliers, datos stale |
| Store | `Observation[]` validadas | IDs persistidos | Fallo de DB, conflicto de ID |

### Frecuencia de ingestión

| Fuente | Frecuencia | Justificación |
|---|---|---|
| OpenMeteo | Cada 1 hora | Datos horarios, bajo costo |
| NASA FIRMS | Cada 3 horas | Satélites polares |
| Sentinel-2 | Cada 5 días | Revisita satelital |
| CHIRPS | Diario | Datos de precipitación diarios |

### Regla de idempotencia

Cada Observation tiene un `id` determinístico basado en `sourceId + timestamp + location + variable`. Re-ingestar los mismos datos no crea duplicados.

---

## 7. Motor de inteligencia (Reasoning Engine)

### Flujo completo

```
Observations (de múltiples fuentes)
    ↓
Event Detector          — ¿Hay algo significativo?
    ↓
Anomaly Detector        — ¿Se desvía de lo normal?
    ↓
Evidence Aggregator     — ¿Qué observaciones respaldan la señal?
    ↓
Hypothesis Generator    — ¿Por qué está pasando?
    ↓
Hallazgo Engine         — Crear/actualizar Hallazgo
    ↓
Priority Engine         — ¿Qué tan urgente es?
    ↓
Strategy Engine         — ¿Qué se recomienda?
    ↓
Copilot / UI            — Presentar al usuario
```

### Módulos del motor

#### 7.1 Event Detector

- **Input:** Observations en ventana temporal (últimas 24-72h)
- **Output:** `DetectedEvent[]` — señales que requieren atención
- **Lógica:** Umbrales por variable y territorio (ej: temperatura > P95 histórico)
- **No usa IA**

#### 7.2 Anomaly Detector

- **Input:** Series temporales de Observations
- **Output:** `Anomaly[]` con severidad y desviación
- **Lógica:** Comparación con baseline histórico (media móvil, percentiles)
- **No usa IA**

#### 7.3 Evidence Aggregator

- **Input:** DetectedEvent + Anomaly + Observations relacionadas
- **Output:** `EvidenceBundle` — conjunto de evidencias con pesos
- **Lógica:** Correlación espacial y temporal entre fuentes
- **No usa IA**

#### 7.4 Hypothesis Generator

- **Input:** EvidenceBundle
- **Output:** `Hypothesis[]` con status (activa, descartada)
- **Lógica:** Reglas causales predefinidas + correlación estadística
- **IA opcional** (Fase 4) — solo para generar texto, no para decidir

#### 7.5 Hallazgo Engine ⭐

- **Input:** EvidenceBundle + Hypothesis[]
- **Output:** `Hallazgo` completo
- **Lógica:** Composición, deduplicación, enriquecimiento, versionado
- **Es el módulo más importante del sistema**

#### 7.6 Priority Engine

- **Input:** Hallazgo + contexto territorial
- **Output:** `PriorityLevel` (crítica, alta, media, baja)
- **Lógica:** Matriz de impacto × urgencia × confianza

#### 7.7 Strategy Engine

- **Input:** Hallazgo priorizado
- **Output:** `Strategy[]` — recomendaciones accionables
- **Lógica:** Catálogo de respuestas por categoría + contexto

### Regla de modularidad

Cada módulo:
- Tiene input/output tipados
- Es testeable de forma independiente
- No conoce la UI
- No llama a OpenAI directamente (excepto Fase 4, capa de lenguaje)

---

## 8. Sistema de evidencia

### Por qué es la ventaja competitiva

Cualquier sistema puede mostrar un mapa con colores. Pocos pueden responder:

> **"¿Por qué dijiste eso?"**

### EvidenceBundle

```typescript
interface EvidenceBundle {
  id: string
  hallazgoId: string

  // Qué se usó
  fuentesUtilizadas: SourceReference[]
  observaciones: Observation[]
  indicadores: Indicator[]

  // Cómo se decidió
  nivelConfianza: ConfidenceScore
  variablesConsideradas: string[]
  metodologia: string

  // Qué se descartó
  hipotesisDescartadas: Hypothesis[]
  observacionesDescartadas: Observation[]
  razonDescarte: string

  // Cuándo y cómo
  fechaGeneracion: string
  versionMotor: string
  modeloUtilizado?: string
}
```

### Trazabilidad completa

Para cada Hallazgo, el sistema puede reconstruir:

1. Qué observaciones entraron
2. Qué eventos se detectaron
3. Qué anomalías se encontraron
4. Qué evidencia se seleccionó (y qué se descartó)
5. Qué hipótesis se probaron (y cuáles se refutaron)
6. Cómo se calculó la confianza
7. Qué modelo/versión del motor produjo el resultado

### Regla de auditabilidad

> Ninguna conclusión visible al usuario puede existir sin un `EvidenceBundle` asociado. Si no hay evidencia, no hay hallazgo.

---

## 9. Índice de confianza

### Definición

El **Índice de Confianza** (`ConfidenceScore`) es un valor de 0 a 100 que indica cuán respaldado está un Hallazgo por evidencia observable.

No es la opinión de la IA. Es un **cálculo determinístico**.

### Fórmula (conceptual)

```
Confianza = f(
  número_de_fuentes_independientes,
  coherencia_temporal,
  coherencia_espacial,
  calidad_de_observaciones,
  corroboración_de_hipótesis,
  antigüedad_de_datos
)
```

### Niveles

| Rango | Nivel | Presentación |
|---|---|---|
| 85-100 | Alta | Verde — acción recomendada |
| 60-84 | Media | Amarillo — validar antes de actuar |
| 30-59 | Baja | Rojo — monitorear |
| 0-29 | Insuficiente | Gris — no presentar como hallazgo |

### Regla

> Un Hallazgo con confianza < 30 no se presenta al usuario ejecutivo. Se almacena para monitoreo interno.

---

## 10. Estrategias

### Definición

Una **Estrategia** es una recomendación accionable derivada de un Hallazgo priorizado.

```typescript
interface Strategy {
  id: string
  hallazgoId: string
  titulo: string
  descripcion: string
  rationale: string              // Por qué se recomienda
  evidencia: EvidenceBundle
  confianza: ConfidenceScore
  prioridad: PriorityLevel
  timeframe: 'inmediato' | 'corto_plazo' | 'mediano_plazo' | 'largo_plazo'
  responsableSugerido?: string
  estado: 'propuesta' | 'aceptada' | 'en_ejecucion' | 'completada'
  generadaEn: string
}
```

### Relación Hallazgo → Estrategia

- Un Hallazgo puede tener 0-N Estrategias
- Toda Estrategia pertenece a exactamente un Hallazgo
- Las Estrategias nunca se generan sin un Hallazgo padre

---

## 11. Las cinco preguntas estratégicas

### Las preguntas son el ADN de la empresa

Cada día, el sistema debe poder responder automáticamente:

| # | Pregunta | Fuente de respuesta |
|---|---|---|
| 1 | ¿Qué está pasando? | Hallazgos activos del día |
| 2 | ¿Por qué está pasando? | Hipótesis confirmadas de esos Hallazgos |
| 3 | ¿Qué podría pasar si continúa? | Proyecciones basadas en tendencias de Observations |
| 4 | ¿Qué merece atención primero? | Hallazgos ordenados por Priority Engine |
| 5 | ¿Qué estrategias recomendamos? | Estrategias derivadas de Hallazgos priorizados |

### Cómo se responden

```
Pregunta 1 → SELECT hallazgos WHERE estado IN ('confirmado', 'priorizado') AND fecha = hoy
Pregunta 2 → SELECT hipótesis WHERE hallazgoId IN (...) AND status = 'validated'
Pregunta 3 → PROJECT trends FROM observations WHERE hallazgoId IN (...)
Pregunta 4 → ORDER hallazgos BY prioridad DESC, confianza DESC
Pregunta 5 → SELECT estrategias WHERE hallazgoId IN (...)
```

Las respuestas son **consultas al motor**, no prompts a OpenAI.

### Informe Diario

El Informe Diario es la compilación automática de las 5 respuestas en un documento ejecutivo. Se genera cada mañana a las 06:00 hora local del territorio.

---

## 12. Rol de la inteligencia artificial

### Principio fundamental

> **OpenAI no analiza datos. OpenAI traduce inteligencia a lenguaje ejecutivo.**

### Qué hace la IA

| Sí | No |
|---|---|
| Resumir Hallazgos en lenguaje ejecutivo | Calcular indicadores científicos |
| Explicar el razonamiento de forma clara | Decidir qué es una anomalía |
| Generar el Informe Diario | Agregar datos de fuentes |
| Responder preguntas sobre Hallazgos existentes | Crear Hallazgos sin evidencia |
| Proponer redacción de Estrategias | Asignar niveles de confianza |

### Input a la IA (siempre estructurado)

```json
{
  "hallazgo": {
    "titulo": "Deterioro acelerado del corredor seco",
    "descripcion": "...",
    "categoria": "vegetacion",
    "prioridad": "alta",
    "confianza": 96
  },
  "evidencia": [
    { "fuente": "Sentinel-2", "variable": "ndvi", "valor": -0.23, "unidad": "index" },
    { "fuente": "CHIRPS", "variable": "rainfall", "valor": -45, "unidad": "% anomalía" }
  ],
  "hipotesis": [
    { "claim": "Estrés hídrico prolongado", "status": "validated", "confianza": 92 }
  ],
  "estrategias": [
    { "titulo": "Validar en campo", "timeframe": "inmediato" }
  ]
}
```

### Output de la IA

Texto ejecutivo. Nada más. El texto se almacena junto al Hallazgo como `resumenEjecutivo`.

### Cuándo se conecta

**Fase 4 — Semana 4.** No antes. El motor debe funcionar sin IA.

---

## 13. Arquitectura del sistema

### Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    TERRITORY INTELLIGENCE OS                 │
│                         (Plataforma)                         │
├─────────────────────────────────────────────────────────────┤
│  Centro Nacional │ Hallazgos │ Prioridades │ Estrategias │ …  │
├─────────────────────────────────────────────────────────────┤
│                    REASONING ENGINE                          │
│  Event → Anomaly → Evidence → Hypothesis → Hallazgo →      │
│  Priority → Strategy                                         │
├─────────────────────────────────────────────────────────────┤
│                    INGESTION PIPELINE                        │
│  Download → Parse → Normalize → Validate → Store            │
├─────────────────────────────────────────────────────────────┤
│                    SOURCE CONNECTORS                         │
│  OpenMeteo │ FIRMS │ Sentinel │ CHIRPS │ GDELT │ …          │
├─────────────────────────────────────────────────────────────┤
│                    DATA LAYER                                │
│  Observation Store │ Hallazgo Store │ Evidence Store          │
├─────────────────────────────────────────────────────────────┤
│                    CORE INFRASTRUCTURE                       │
│  Auth │ Permissions │ Audit │ Config │ Telemetry            │
└─────────────────────────────────────────────────────────────┘
```

### Stack tecnológico

| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | React, Vite, TypeScript, TailwindCSS | Implementado (Fase UI) |
| Estado | Zustand, TanStack Query | Implementado |
| Backend | Por definir (Node/Bun o Python) | Pendiente |
| Base de datos | Por definir (PostgreSQL + PostGIS) | Pendiente |
| Cola de trabajos | Por definir (BullMQ o similar) | Pendiente |
| IA | OpenAI API | Fase 4 |
| Storage | Por definir (S3 o local) | Pendiente |

### Organización del código (frontend actual)

```
src/
├── app/                    # Bootstrap
├── core/                   # Infraestructura transversal
├── intelligence/           # Tipos y lógica del motor (compartida)
├── sources/                # Conectores de fuentes (stubs)
├── modules/                # Apps del OS (UI por dominio)
│   ├── national-center/    # Situación Nacional
│   ├── copilot/            # Análisis profundo
│   ├── findings/           # Hallazgos
│   ├── priorities/         # Prioridades
│   ├── strategies/         # Estrategias
│   └── ...
└── shared/                 # UI compartida
```

### Organización del código (backend futuro)

```
backend/
├── pipeline/
│   ├── downloader/
│   ├── parser/
│   ├── normalizer/
│   └── validator/
├── connectors/
│   ├── openmeteo/
│   ├── nasa-firms/
│   ├── sentinel-2/
│   └── chirps/
├── engine/
│   ├── event-detector/
│   ├── anomaly-detector/
│   ├── evidence-aggregator/
│   ├── hypothesis-generator/
│   ├── hallazgo-engine/      ⭐
│   ├── priority-engine/
│   └── strategy-engine/
├── stores/
│   ├── observation.store/
│   ├── hallazgo.store/
│   └── evidence.store/
└── api/                        # REST/GraphQL para el frontend
```

---

## 14. Territory Intelligence OS

### Concepto

TerraMind no es una aplicación. Es un **sistema operativo** donde cada módulo de la UI es una "app" que consume Hallazgos de formas diferentes:

| App del OS | Consume Hallazgos como… |
|---|---|
| Centro Nacional | Situación general + briefing diario |
| Hallazgos | Lista completa con filtros |
| Prioridades | Hallazgos ordenados por urgencia |
| Estrategias | Recomendaciones derivadas |
| Territorio | Hallazgos georreferenciados |
| Copilot | Análisis profundo de las 5 preguntas |
| Fuentes | Estado de conectores |
| Conocimiento | Contexto institucional |

### Regla del OS

> Ninguna app del OS implementa lógica de razonamiento. Todas consumen Hallazgos del motor.

---

## 15. Roadmap

### Semana 1 — Fundamentos ✅ (parcialmente completado)

- [x] Arquitectura frontend (Territory Intelligence OS)
- [x] Tipos del dominio (Evidence, Hypothesis, Conclusion)
- [x] UI de Situación Nacional (demo)
- [x] Catálogo de fuentes (stubs)
- [ ] **PRD como constitución** ← este documento
- [ ] Tipos `Observation` y `Hallazgo` en código
- [ ] Estructura del backend / pipeline

### Semana 2 — Primeras fuentes

- [ ] Conector OpenMeteo (Sprint 1)
- [ ] Conector NASA FIRMS (Sprint 2)
- [ ] Observation Store (persistencia)
- [ ] Primer Hallazgo generado automáticamente
- [ ] UI de Hallazgos conectada a datos reales

### Semana 3 — Motor de evidencia

- [ ] Conector Sentinel-2 (Sprint 3)
- [ ] Conector CHIRPS (Sprint 4)
- [ ] Event Detector + Anomaly Detector
- [ ] Evidence Aggregator
- [ ] Hallazgo Engine v1
- [ ] Índice de confianza calculado

### Semana 4 — Inteligencia y lenguaje

- [ ] Hypothesis Generator
- [ ] Priority Engine + Strategy Engine
- [ ] Integración OpenAI (solo capa de lenguaje)
- [ ] Informe Diario automático
- [ ] Las 5 preguntas respondidas con datos reales

### Mes 2-3 — Expansión

- [ ] Fuentes oficiales (INSIVUMEH, MAGA, MARN)
- [ ] GDELT (noticias)
- [ ] Auth y permisos por territorio
- [ ] Notificaciones de nuevos Hallazgos
- [ ] API pública

---

## 16. Principios de ingeniería

### Los 10 mandamientos de TerraMind

1. **El Hallazgo es el átomo.** Todo existe para producirlo.
2. **La evidencia es sagrada.** Sin evidencia, sin hallazgo.
3. **La IA interpreta, no calcula.** Los indicadores vienen de modelos físicos.
4. **El pipeline es el corazón.** Sin ingestión, no hay inteligencia.
5. **El motor es el producto.** La UI es la interfaz.
6. **La confianza se calcula, no se opina.** Es determinística.
7. **Cada conclusión es auditable.** "¿Por qué dijiste eso?" siempre tiene respuesta.
8. **Una fuente no está conectada hasta que produce Observations.** Health check verde no cuenta.
9. **El sistema habla primero.** El usuario no hace consultas; recibe hallazgos.
10. **Este PRD es la constitución.** Si contradice el código, el código está mal.

### Anti-patrones (lo que NO haremos)

| Anti-patrón | Por qué |
|---|---|
| Empezar por el frontend | Ya lo hicimos — no repetir |
| Conectar OpenAI primero | La IA es la última capa |
| Hacer mapas antes del motor | Los mapas son vistas de hallazgos |
| Datos mock elaborados | Demo UX ≠ datos falsos en producción |
| Organizar por componentes | Organizar por dominio de negocio |
| Copilot como chat libre | Las 5 preguntas son la estructura |
| Calcular NDVI con IA | Los índices vienen de Sentinel |

---

## 17. Glosario

| Término | Definición |
|---|---|
| **Hallazgo** | Unidad atómica de inteligencia saliente del sistema |
| **Observation** | Unidad atómica de dato entrante normalizado |
| **Evidence** | Observation o Indicator seleccionado para respaldar un Hallazgo |
| **EvidenceBundle** | Conjunto completo de evidencia con trazabilidad |
| **Hypothesis** | Explicación causal propuesta para un Hallazgo |
| **Strategy** | Recomendación accionable derivada de un Hallazgo |
| **ConfidenceScore** | Índice 0-100 de certeza calculado determinísticamente |
| **SourceConnector** | Implementación del pipeline para una fuente de datos |
| **Reasoning Engine** | Conjunto de módulos que transforman Observations en Hallazgos |
| **Hallazgo Engine** | Módulo central que compone y gestiona Hallazgos |
| **Territory Intelligence OS** | La plataforma como sistema operativo de apps |
| **Informe Diario** | Compilación automática de las 5 preguntas estratégicas |
| **Situación Nacional** | Vista principal — el país siendo observado en tiempo real |

---

## 18. Decisiones abiertas

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| 1 | Backend runtime | Node/Bun vs Python | Python para pipeline científico, Node para API |
| 2 | Base de datos | PostgreSQL + PostGIS vs TimescaleDB | PostgreSQL + PostGIS |
| 3 | Cola de trabajos | BullMQ vs Celery vs Inngest | BullMQ si Node, Celery si Python |
| 4 | Nombre final | TerraMind vs GeoMind vs Atlas AI | TerraMind (working title) |
| 5 | Territorio inicial | Guatemala | Guatemala (GT) |
| 6 | Hosting | Cloud vs on-premise gobierno | Por definir con cliente |
| 7 | Licencia de datos | Open data vs acuerdos institucionales | Solo fuentes públicas en MVP |

---

## Apéndice A: Checklist de conformidad

Antes de mergear cualquier PR, verificar:

- [ ] ¿Produce, consume o enriquece un Hallazgo?
- [ ] ¿Tiene EvidenceBundle asociado?
- [ ] ¿La IA solo traduce, no calcula?
- [ ] ¿Los tipos están en `intelligence/types/`?
- [ ] ¿El conector implementa el pipeline completo?
- [ ] ¿La confianza se calcula, no se asigna manualmente?
- [ ] ¿Es testeable sin la UI?
- [ ] ¿Respeta las 5 preguntas estratégicas?

---

## Apéndice B: Diagrama de flujo de datos

```
Fuentes externas
  OpenMeteo ──┐
  NASA FIRMS ─┤
  Sentinel-2 ─┤──→ Pipeline ──→ Observations ──→ Reasoning Engine ──→ Hallazgos
  CHIRPS ─────┤                                                        │
  GDELT ──────┤                                                        ├──→ Centro Nacional
  INSIVUMEH ──┘                                                        ├──→ Hallazgos (lista)
                                                                       ├──→ Prioridades
                    Evidence Bundles ←─────────────────────────────────┤
                                                                       ├──→ Estrategias
                    OpenAI (solo lenguaje) ←── Hallazgos + Evidence ───├──→ Informe Diario
                                                                       └──→ Copilot
```

---

*Este documento es la constitución de TerraMind. Versión 0.1 — Julio 2026.*
