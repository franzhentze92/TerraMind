import type { Regla } from './types'

/**
 * Reglas semilla del Libro de Reglas.
 * Ver docs/RULE-BOOK.md para descripción completa.
 */
export const SEED_RULES: Regla[] = [
  {
    id: 'R-DET-001',
    nombre: 'Caída significativa de NDVI',
    version: '1.0',
    categoria: 'deteccion',
    activa: true,
    prioridad: 10,
    condiciones: [
      { variableId: 'ndvi', operador: 'cambio_%', valor: -10, ventana: '16d' },
    ],
    accion: {
      tipo: 'crear_evento',
      parametros: { tipo: 'ndvi_drop', severidad: 'significativa' },
    },
    variablesInvolucradas: ['ndvi'],
    descripcion: 'Detecta caída de NDVI mayor al 10% en 16 días',
  },
  {
    id: 'R-DET-003',
    nombre: 'Foco de calor detectado',
    version: '1.0',
    categoria: 'deteccion',
    activa: true,
    prioridad: 20,
    condiciones: [
      { variableId: 'fire_radiative_power', operador: '>', valor: 0 },
    ],
    accion: {
      tipo: 'crear_evento',
      parametros: { tipo: 'fire_detected', severidad: 'moderada' },
    },
    variablesInvolucradas: ['fire_radiative_power'],
    descripcion: 'Detecta cualquier foco de calor de NASA FIRMS',
  },
  {
    id: 'R-COR-FIRE',
    nombre: 'Cluster de focos de calor → Hallazgo incendio',
    version: '1.0',
    categoria: 'correlacion',
    activa: true,
    prioridad: 15,
    condiciones: [
      { eventoTipo: 'fire_cluster', operador: 'existe', ventana: '24h' },
      { variableId: 'fire_radiative_power', operador: '>', valor: 0 },
    ],
    accion: {
      tipo: 'crear_hallazgo',
      parametros: {
        categoria: 'incendio',
        titulo: 'Focos de calor activos',
        minClusterSize: 3,
      },
    },
    variablesInvolucradas: ['fire_radiative_power'],
    descripcion: 'Agrupa focos FIRMS cercanos en un Hallazgo de incendio (Sprint 1)',
  },
  {
    id: 'R-COR-001',
    nombre: 'Riesgo agrícola por estrés múltiple',
    version: '1.0',
    categoria: 'correlacion',
    activa: true,
    prioridad: 10,
    condiciones: [
      { eventoTipo: 'ndvi_drop', operador: 'existe', ventana: '30d' },
      { eventoTipo: 'rainfall_deficit', operador: 'existe', ventana: '30d' },
      { eventoTipo: 'temp_anomaly', operador: 'existe', ventana: '30d' },
    ],
    accion: {
      tipo: 'crear_hallazgo',
      parametros: {
        categoria: 'compuesto',
        titulo: 'Riesgo agrícola por estrés hídrico y térmico',
      },
    },
    variablesInvolucradas: ['ndvi', 'rainfall_anomaly', 'temperature_anomaly'],
    descripcion: 'Correlaciona caída de vegetación con déficit de lluvia y anomalía térmica',
  },
  {
    id: 'R-HIP-001',
    nombre: 'Estrés hídrico',
    version: '1.0',
    categoria: 'hipotesis',
    activa: true,
    prioridad: 10,
    condiciones: [
      { eventoTipo: 'rainfall_deficit', operador: 'existe' },
      { eventoTipo: 'ndvi_drop', operador: 'existe' },
    ],
    excepciones: [
      { eventoTipo: 'fire_detected', operador: 'existe' },
    ],
    accion: {
      tipo: 'crear_hipotesis',
      parametros: {
        afirmacion: 'Estrés hídrico prolongado como causa principal',
      },
    },
    variablesInvolucradas: ['ndvi', 'rainfall_anomaly'],
    descripcion: 'Propone estrés hídrico cuando hay déficit de lluvia y caída de NDVI',
  },
  {
    id: 'R-INH-001',
    nombre: 'Datos insuficientes',
    version: '1.0',
    categoria: 'inhibicion',
    activa: true,
    prioridad: 1,
    condiciones: [],
    accion: {
      tipo: 'inhibir',
      parametros: {
        razon: 'evidencia_insuficiente',
        minObservaciones: 3,
        minFuentes: 2,
      },
    },
    variablesInvolucradas: [],
    descripcion: 'Bloquea creación de hallazgos visibles sin evidencia mínima',
  },
  {
    id: 'R-INH-004',
    nombre: 'NDVI bajo pero lluvia normal',
    version: '1.0',
    categoria: 'inhibicion',
    activa: true,
    prioridad: 5,
    condiciones: [
      { eventoTipo: 'ndvi_drop', operador: 'existe' },
      { variableId: 'rainfall_anomaly', operador: 'dentro_rango', valor: 15, compararCon: 'baseline' },
    ],
    accion: {
      tipo: 'solicitar_datos',
      parametros: {
        razon: 'Causa no determinada — lluvia normal con NDVI bajo',
        solicitar: ['sentinel_sin_nubes', 'soil_moisture'],
      },
    },
    variablesInvolucradas: ['ndvi', 'rainfall_anomaly'],
    descripcion: 'No concluye estrés hídrico cuando la lluvia es normal',
  },
  {
    id: 'R-EST-001',
    nombre: 'Validar en campo',
    version: '1.0',
    categoria: 'estrategia',
    activa: true,
    prioridad: 10,
    condiciones: [],
    accion: {
      tipo: 'crear_estrategia',
      parametros: {
        titulo: 'Validar en campo',
        horizonte: 'inmediato',
        acciones: ['Despachar equipo de verificación', 'Actualizar en 48h'],
        minConfianza: 60,
        maxConfianza: 85,
      },
    },
    variablesInvolucradas: [],
    descripcion: 'Recomienda validación en campo cuando la confianza es media',
  },
]

export function getRulesByCategory(categoria: Regla['categoria']): Regla[] {
  return SEED_RULES.filter((r) => r.categoria === categoria)
}

export function getActiveRules(): Regla[] {
  return SEED_RULES.filter((r) => r.activa)
}
