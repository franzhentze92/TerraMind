# Catálogo Nacional de Variables — TerraMind

**Versión:** 0.1 (semilla)  
**Objetivo:** ~200 variables al completar  
**Rol:** Vocabulario semántico del sistema — el conocimiento, no las APIs

---

## Qué es una Variable

Una Variable no es un dato. Es la **definición** de qué se mide, cómo interpretarlo y con qué se relaciona.

```
API (Sentinel)  →  produce datos  →  Observaciones de variable "ndvi"
Catálogo        →  define qué es   →  Variable "ndvi"
```

Cuando el Catálogo esté completo, el sistema sabrá **qué hacer** con cada dato antes de conectar la API.

---

## Esquema de Variable

```
Variable {
  id: string                    // "ndvi", "rainfall_daily", "fire_radiative_power"
  nombre: string                // "Índice de Vegetación de Diferencia Normalizada"
  nombreCorto: string           // "NDVI"
  categoria: vegetacion | clima | hidrologia | incendio | suelo | institucional

  // Origen
  fuenteId: string              // "sentinel-2"
  fuenteAlternativas?: string[]

  // Medición
  unidad: string                // "índice", "mm", "°C", "MW"
  tipoValor: numerico | categorico | booleano
  resolucionEspacial: string    // "10m", "5.5km"
  resolucionTemporal: string    // "16 días", "diario", "horario"
  frecuenciaActualizacion: string

  // Interpretación
  rangoNormal: { min: number, max: number }
  interpretacion: string        // "Mayor valor = vegetación más saludable"
  direccionPreferida: "alto" | "bajo" | "estable" | "neutral"

  // Relaciones
  variablesRelacionadas: string[]
  usadaEnReglas: string[]       // IDs de reglas que la referencian
  categoriasHallazgo: string[]  // Qué tipos de hallazgo puede generar

  // Detección
  umbralAlerta?: number
  umbralCritico?: number
  metodoBaseline: "media_movil_30d" | "percentil_historico" | "estacional"

  activa: boolean
  version: string
}
```

---

## Variables semilla (Sprint 1-4)

### Vegetación

#### `ndvi`
| Campo | Valor |
|-------|-------|
| Nombre | Índice de Vegetación de Diferencia Normalizada |
| Fuente | Sentinel-2 |
| Unidad | índice (-1 a 1) |
| Actualización | 5 días |
| Rango normal | 0.6 – 0.8 (Guatemala, época lluviosa) |
| Interpretación | Mayor valor = vegetación más saludable y densa |
| Relacionadas | `evi`, `ndmi`, `rainfall_daily`, `temperature_anomaly` |
| Umbral alerta | Caída > 10% en 16 días |
| Umbral crítico | Caída > 20% en 16 días |

#### `evi`
| Campo | Valor |
|-------|-------|
| Nombre | Índice de Vegetación Mejorado |
| Fuente | Sentinel-2 |
| Unidad | índice |
| Relacionadas | `ndvi`, `ndmi` |

#### `ndmi`
| Campo | Valor |
|-------|-------|
| Nombre | Índice de Humedad de Diferencia Normalizada |
| Fuente | Sentinel-2 |
| Unidad | índice (-1 a 1) |
| Interpretación | Indicador de estrés hídrico en vegetación |
| Relacionadas | `ndvi`, `rainfall_daily`, `soil_moisture` |

---

### Clima

#### `temperature`
| Campo | Valor |
|-------|-------|
| Nombre | Temperatura del aire a 2m |
| Fuente | OpenMeteo (ERA5) |
| Unidad | °C |
| Actualización | Horaria |
| Rango normal | 18 – 32°C (Guatemala, tierras bajas) |
| Relacionadas | `temperature_anomaly`, `rainfall_daily`, `humidity` |

#### `temperature_anomaly`
| Campo | Valor |
|-------|-------|
| Nombre | Anomalía de temperatura |
| Fuente | ERA5 |
| Unidad | °C (desviación de media histórica) |
| Interpretación | Positivo = más caliente de lo normal |
| Umbral alerta | > +2°C |
| Umbral crítico | > +4°C |

#### `rainfall_daily`
| Campo | Valor |
|-------|-------|
| Nombre | Precipitación diaria |
| Fuente | CHIRPS |
| Unidad | mm |
| Actualización | Diaria (rezago 2-3 días) |
| Rango normal | Variable por estación y región |
| Relacionadas | `rainfall_anomaly`, `ndvi`, `ndmi` |

#### `rainfall_anomaly`
| Campo | Valor |
|-------|-------|
| Nombre | Anomalía de precipitación |
| Fuente | CHIRPS |
| Unidad | % de desviación de la media |
| Umbral alerta | < -30% acumulado 30 días |
| Umbral crítico | < -50% acumulado 30 días |

#### `humidity`
| Campo | Valor |
|-------|-------|
| Nombre | Humedad relativa |
| Fuente | OpenMeteo |
| Unidad | % |
| Actualización | Horaria |

#### `wind_speed`
| Campo | Valor |
|-------|-------|
| Nombre | Velocidad del viento |
| Fuente | OpenMeteo |
| Unidad | km/h |
| Relacionadas | `fire_radiative_power` (propagación de incendios) |

---

### Incendios

#### `fire_radiative_power`
| Campo | Valor |
|-------|-------|
| Nombre | Potencia radiativa de fuego |
| Fuente | NASA FIRMS |
| Unidad | MW |
| Actualización | 3 horas |
| Interpretación | Intensidad del foco de calor detectado |
| Relacionadas | `fire_count`, `temperature_anomaly`, `ndvi` |
| Umbral alerta | > 0 (cualquier detección) |
| Umbral crítico | FRP > 50 MW o cluster > 5 focos |

#### `fire_count`
| Campo | Valor |
|-------|-------|
| Nombre | Conteo de focos de calor |
| Fuente | NASA FIRMS |
| Unidad | conteo |
| Actualización | 3 horas |
| Relacionadas | `fire_radiative_power` |

---

### Hidrología

#### `soil_moisture`
| Campo | Valor |
|-------|-------|
| Nombre | Humedad del suelo |
| Fuente | ERA5 / SoilGrids |
| Unidad | m³/m³ |
| Relacionadas | `rainfall_daily`, `ndmi`, `ndvi` |

---

### Institucional

#### `official_alert`
| Campo | Valor |
|-------|-------|
| Nombre | Alerta oficial |
| Fuente | INSIVUMEH |
| Unidad | categorico (verde/amarillo/naranja/rojo) |
| Actualización | Según emisión |
| Relacionadas | `rainfall_anomaly`, `temperature_anomaly` |

#### `official_bulletin`
| Campo | Valor |
|-------|-------|
| Nombre | Boletín oficial |
| Fuente | INSIVUMEH, MAGA, MARN |
| Unidad | texto |
| Actualización | Diaria/semanal |

---

## Categorías de variables (para expansión)

| Categoría | Variables estimadas | Fuentes |
|-----------|---------------------|---------|
| Vegetación | ~25 | Sentinel, MODIS, Landsat |
| Clima | ~40 | ERA5, OpenMeteo, CHIRPS |
| Hidrología | ~20 | CHIRPS, ERA5, gauges |
| Incendios | ~10 | NASA FIRMS, VIIRS |
| Suelo | ~15 | SoilGrids, FAO |
| Institucional | ~20 | INSIVUMEH, MAGA, MARN |
| Socioambiental | ~15 | GDELT, noticias |
| Agrícola | ~20 | MAGA, FAO, Sentinel |
| Geológico | ~10 | INSIVUMEH, USGS |
| Calidad del aire | ~10 | CAMS, estaciones |
| **Total estimado** | **~185** | |

---

## Reglas del catálogo

1. Toda Observación debe referenciar una Variable del catálogo
2. Toda Regla del Libro de Reglas opera sobre Variables, no sobre APIs
3. Una Variable puede tener múltiples fuentes — el catálogo define la semántica, la fuente define el origen
4. Las Variables se versionan — cambios de umbral o rango normal generan nueva versión
5. El catálogo es el activo intelectual de la empresa

---

*Catálogo v0.1 — Semilla con 15 variables. Objetivo: ~200.*
