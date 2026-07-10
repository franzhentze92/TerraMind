# Biblioteca de Estrategias — TerraMind

**Versión:** 0.1 (semilla)  
**Rol:** Conocimiento experto sobre respuestas posibles  
**Principio:** Cada hipótesis tiene estrategias predefinidas en 3 niveles

---

## Esquema

```
EstrategiaTemplate {
  id: string
  hipotesisId: string           // A qué hipótesis responde
  nivel: conservadora | balanceada | intensiva

  objetivo: string
  acciones: string[]
  horizonte: TimeHorizon
  responsableSugerido: string

  // Cuándo aplicar
  condiciones: {
    minConfianza: number
    maxConfianza?: number
    minPrioridad: PriorityLevel
  }

  // Cómo saber si funcionó
  indicadoresConfirmacion: IndicadorSeguimiento[]
  indicadoresCierre: IndicadorSeguimiento[]

  version: string
  activa: boolean
}
```

---

## Estrategias por hipótesis

### HIP-001: Estrés hídrico

#### Conservadora
| Campo | Valor |
|-------|-------|
| Objetivo | Monitorear evolución sin intervención inmediata |
| Acciones | Aumentar frecuencia de observación a 24h, Programar próximo informe en 7 días |
| Horizonte | corto_plazo |
| Min confianza | 50 |
| Confirmación | `rainfall_anomaly` mejora, `ndvi` estabiliza |
| Cierre | `ndvi` recupera > 5% O `rainfall_anomaly` normaliza |

#### Balanceada
| Campo | Valor |
|-------|-------|
| Objetivo | Validar en campo y activar protocolo preventivo |
| Acciones | Despachar equipo de verificación, Activar protocolo de sequía regional, Notificar a MAGA |
| Horizonte | inmediato |
| Min confianza | 60 |
| Confirmación | Reporte de campo confirma estrés, `soil_moisture` baja |
| Cierre | Protocolo de sequía activado + validación completada |

#### Intensiva
| Campo | Valor |
|-------|-------|
| Objetivo | Respuesta de emergencia ante sequía confirmada |
| Acciones | Solicitar declaratoria de emergencia, Despachar equipos multidisciplinarios, Activar distribución de agua de emergencia |
| Horizonte | inmediato |
| Min confianza | 85 |
| Confirmación | Múltiples departamentos afectados, `rainfall_anomaly < -50%` |
| Cierre | Declaratoria emitida + plan de respuesta en ejecución |

---

### HIP-003: Incendio

#### Conservadora
| Campo | Valor |
|-------|-------|
| Objetivo | Monitorear focos detectados |
| Acciones | Monitorear propagación cada 3h, Solicitar imágenes de alta resolución |
| Horizonte | inmediato |
| Min confianza | 50 |

#### Balanceada
| Campo | Valor |
|-------|-------|
| Objetivo | Activar respuesta coordinada |
| Acciones | Notificar CONRED, Coordinar con bomberos locales, Establecer perímetro de monitoreo |
| Horizonte | inmediato |
| Min confianza | 70 |

#### Intensiva
| Campo | Valor |
|-------|-------|
| Objetivo | Respuesta de emergencia ante incendio activo |
| Acciones | Solicitar apoyo aéreo, Evacuar zonas de riesgo, Activar centro de operaciones de emergencia |
| Horizonte | inmediato |
| Min confianza | 85 |
| Condición extra | `fire_radiative_power > 50 MW` OR cluster > 5 focos |

---

### HIP-006: Causa no determinada

#### Única (no tiene niveles)
| Campo | Valor |
|-------|-------|
| Objetivo | Investigar antes de actuar |
| Acciones | Solicitar imagen satelital sin nubes, Programar verificación en campo, Re-evaluar en 48h |
| Horizonte | inmediato |
| Min confianza | 0 (siempre aplica) |
| Cierre | Causa determinada (otra HIP se activa) O datos insuficientes persisten > 7 días |

---

## Indicadores de seguimiento

```
IndicadorSeguimiento {
  variableId: string
  condicion: string           // "mejora", "empeora", "estabiliza", "normaliza"
  ventana: string
  umbral?: number
}
```

**Ejemplo:**
```
Confirmación: { variableId: "ndvi", condicion: "estabiliza", ventana: "7d" }
Cierre: { variableId: "rainfall_anomaly", condicion: "normaliza", ventana: "14d" }
```

---

## Reglas de la biblioteca

1. Toda hipótesis confirmada tiene al menos una estrategia
2. Siempre se presentan 3 niveles (excepto HIP-006)
3. Las estrategias nunca se generan sin Hallazgo padre
4. `minConfianza` impide estrategias prematuras
5. Los indicadores de cierre definen cuándo el caso se resuelve

---

*Strategy Library v0.1 — Estrategias semilla para 3 hipótesis principales.*
