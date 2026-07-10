# Libro de Reglas — TerraMind

**Versión:** 0.1 (semilla)  
**Rol:** Conocimiento experto codificado — NO es IA  
**Principio:** Las reglas detectan, correlacionan y recomiendan. La IA solo traduce.

---

## Anatomía de una regla

```
Regla {
  id: string
  nombre: string
  version: string
  categoria: deteccion | correlacion | hipotesis | prioridad | estrategia | inhibicion
  activa: boolean
  prioridad: number

  SI:   Condicion[]        // Todas deben cumplirse (AND)
  EXCEPTO: Condicion[]     // Si alguna se cumple, NO ejecutar
  ENTONCES: Accion

  territorioIds?: string[]
  variablesInvolucradas: string[]
  descripcion: string
}
```

---

## Capítulo 1: Reglas de Detección (Observación → Evento)

### R-DET-001: Caída significativa de NDVI
```
SI:
  variable = ndvi
  cambio_% < -10
  ventana = 16d
  territorio = cualquiera

ENTONCES:
  crear Evento {
    tipo: "ndvi_drop"
    severidad: significativa
  }
```

### R-DET-002: Caída crítica de NDVI
```
SI:
  variable = ndvi
  cambio_% < -20
  ventana = 16d

ENTONCES:
  crear Evento {
    tipo: "ndvi_drop_critical"
    severidad: critica
  }
```

### R-DET-003: Foco de calor detectado
```
SI:
  variable = fire_radiative_power
  valor > 0

ENTONCES:
  crear Evento {
    tipo: "fire_detected"
    severidad: moderada
  }
```

### R-DET-004: Foco de calor intenso
```
SI:
  variable = fire_radiative_power
  valor > 50
  unidad = MW

ENTONCES:
  crear Evento {
    tipo: "fire_intense"
    severidad: critica
  }
```

### R-DET-005: Anomalía térmica
```
SI:
  variable = temperature_anomaly
  valor > 2
  unidad = °C
  ventana = 7d

ENTONCES:
  crear Evento {
    tipo: "temp_anomaly"
    severidad: significativa
  }
```

### R-DET-006: Déficit pluviométrico
```
SI:
  variable = rainfall_anomaly
  valor < -30
  unidad = %
  ventana = 30d

ENTONCES:
  crear Evento {
    tipo: "rainfall_deficit"
    severidad: significativa
  }
```

### R-DET-007: Déficit pluviométrico crítico
```
SI:
  variable = rainfall_anomaly
  valor < -50
  unidad = %
  ventana = 30d

ENTONCES:
  crear Evento {
    tipo: "rainfall_deficit_critical"
    severidad: critica
  }
```

---

## Capítulo 2: Reglas de Correlación (Evento → Hallazgo)

### R-COR-001: Riesgo agrícola por estrés múltiple
```
SI:
  existe Evento tipo "ndvi_drop"
  Y existe Evento tipo "rainfall_deficit"
  Y existe Evento tipo "temp_anomaly"
  Y mismo territorioId
  Y ventana temporal = 30d

ENTONCES:
  crear Hallazgo {
    categoria: compuesto
    titulo: "Riesgo agrícola por estrés hídrico y térmico"
    estado: detectado
    abrir Expediente
  }
```

### R-COR-002: Corredor seco en deterioro
```
SI:
  existe Evento tipo "ndvi_drop"
  Y existe Evento tipo "rainfall_deficit"
  Y territorioId IN corredor_seco
  Y ventana = 21d

ENTONCES:
  crear Hallazgo {
    categoria: vegetacion
    titulo: "Deterioro acelerado del corredor seco"
    estado: detectado
    abrir Expediente
  }
```

### R-COR-003: Riesgo de incendio elevado
```
SI:
  existe Evento tipo "fire_detected"
  Y existe Evento tipo "temp_anomaly"
  Y territorioId = mismo
  Y ventana = 7d

ENTONCES:
  crear Hallazgo {
    categoria: incendio
    titulo: "Riesgo elevado de propagación de incendio"
    estado: detectado
    abrir Expediente
  }
```

### R-COR-004: Correlación espacial
```
SI:
  existen >= 3 Eventos del mismo tipo
  Y dentro de radio 50km
  Y ventana = 14d

ENTONCES:
  agrupar en un solo Hallazgo
  actualizar Expediente
```

---

## Capítulo 3: Reglas de Hipótesis (Hallazgo → Hipótesis)

### R-HIP-001: Estrés hídrico
```
SI:
  Hallazgo.categoria IN [vegetacion, compuesto]
  Y existen Eventos tipo "rainfall_deficit"
  Y existen Eventos tipo "ndvi_drop"
  Y NO existen Eventos tipo "fire_detected"

ENTONCES:
  crear Hipótesis {
    afirmacion: "Estrés hídrico prolongado como causa principal"
    estado: propuesta
    confianza: calcular(señales)
  }
```

### R-HIP-002: Incendio como causa de NDVI
```
SI:
  Hallazgo tiene Eventos tipo "ndvi_drop"
  Y Hallazgo tiene Eventos tipo "fire_detected"
  Y temporalmente: fire_detected ANTES de ndvi_drop

ENTONCES:
  crear Hipótesis {
    afirmacion: "Pérdida de vegetación causada por incendio"
    estado: propuesta
  }
```

### R-HIP-003: No concluir sin evidencia suficiente
```
SI:
  Hallazgo tiene Eventos tipo "ndvi_drop"
  Y rainfall_anomaly DENTRO de rango normal
  Y temperature_anomaly DENTRO de rango normal

ENTONCES:
  crear Hipótesis {
    afirmacion: "Causa no determinada — se requiere investigación adicional"
    estado: propuesta
    confianza: < 30
  }
  NO generar Estrategia
  marcar Expediente: pendiente_validacion
```

---

## Capítulo 4: Reglas de Inhibición (cuándo NO actuar)

### R-INH-001: Datos insuficientes
```
SI:
  observacionCount < 3
  O fuentesIndependientes < 2

ENTONCES:
  NO crear Hallazgo visible
  almacenar como borrador interno
  marcar: "evidencia_insuficiente"
```

### R-INH-002: Contradicción de evidencia
```
SI:
  evidenciaAFavor.count >= 2
  Y evidenciaEnContra.count >= 2
  Y ratio < 2:1

ENTONCES:
  NO confirmar Hipótesis
  estado Hallazgo: en_investigacion
  NO generar Estrategia
  programar re-evaluación en 24h
```

### R-INH-003: Cobertura de nubes
```
SI:
  Observación.flags contiene "cloud_cover_high"
  Y no hay Observación alternativa en ventana 30d

ENTONCES:
  NO usar esa Observación para detección
  registrar en Expediente: "dato_no_disponible"
```

### R-INH-004: NDVI bajo pero lluvia normal
```
SI:
  Evento tipo "ndvi_drop"
  Y rainfall_anomaly DENTRO de rango normal (-15% a +15%)

ENTONCES:
  NO concluir estrés hídrico
  generar Hipótesis: "Causa no determinada"
  solicitar más datos (Sentinel sin nubes, campo)
```

---

## Capítulo 5: Reglas de Prioridad (Hallazgo → Prioridad)

### R-PRI-001: Prioridad crítica
```
SI:
  Hallazgo.riesgo.nivel = critico
  Y Hallazgo.confianza >= 70
  Y Hallazgo.categoria = incendio

ENTONCES:
  asignar Prioridad { nivel: critica, score: 90+ }
```

### R-PRI-002: Escalamiento por múltiples fuentes
```
SI:
  Hallazgo.fuentesIndependientes >= 4
  Y Hallazgo.confianza >= 80

ENTONCES:
  incrementar Prioridad en un nivel
```

### R-PRI-003: Incendio + temperatura alta
```
SI:
  Hallazgo.categoria = incendio
  Y existe Evento tipo "temp_anomaly" en mismo territorio

ENTONCES:
  incrementar Prioridad { razon: "Condiciones favorables para propagación" }
```

---

## Capítulo 6: Reglas de Estrategia (Hallazgo → Estrategia)

### R-EST-001: Validar en campo
```
SI:
  Hallazgo.estado = confirmado
  Y Hallazgo.confianza >= 60
  Y Hallazgo.confianza < 85

ENTONCES:
  crear Estrategia {
    titulo: "Validar en campo"
    horizonte: inmediato
    acciones: ["Despachar equipo de verificación", "Actualizar en 48h"]
  }
```

### R-EST-002: Monitoreo intensivo
```
SI:
  Hallazgo.estado = confirmado
  Y Hallazgo.categoria IN [vegetacion, hidrologico]

ENTONCES:
  crear Estrategia {
    titulo: "Activar monitoreo intensivo"
    horizonte: corto_plazo
    acciones: ["Aumentar frecuencia de observación a 24h", "Programar próximo informe"]
  }
```

### R-EST-003: Protocolo de incendio
```
SI:
  Hallazgo.categoria = incendio
  Y Hallazgo.prioridad.nivel IN [alta, critica]

ENTONCES:
  crear Estrategia {
    titulo: "Activar protocolo de respuesta a incendio"
    horizonte: inmediato
    acciones: ["Notificar CONRED", "Solicitar imágenes de alta resolución", "Monitorear propagación cada 3h"]
  }
```

### R-EST-004: No generar estrategia sin confianza
```
SI:
  Hallazgo.confianza < 50

ENTONCES:
  NO generar Estrategia
  marcar Expediente: pendiente_validacion
```

---

## Orden de evaluación

```
1. Reglas de Inhibición     (¿debemos callar?)
2. Reglas de Detección      (¿hay señal?)
3. Reglas de Correlación    (¿hay patrón?)
4. Reglas de Hipótesis      (¿por qué?)
5. Reglas de Prioridad      (¿qué tan urgente?)
6. Reglas de Estrategia     (¿qué hacer?)
```

Las reglas de inhibición se evalúan **primero** y pueden bloquear todo lo demás.

---

## Versionado

Cada regla tiene `version`. Cambios en umbrales o condiciones generan nueva versión. Los Hallazgos almacenan `reglaVersion` para trazabilidad.

---

*Libro de Reglas v0.1 — 20 reglas semilla. Objetivo: ~100 reglas por categoría territorial.*
