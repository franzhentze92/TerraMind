import type { EntityId, PriorityLevel, TimeHorizon } from '@/ontology/primitives'

export type StrategyLevel = 'conservadora' | 'balanceada' | 'intensiva'

export interface TrackingIndicator {
  variableId: EntityId
  condicion: 'mejora' | 'empeora' | 'estabiliza' | 'normaliza'
  ventana: string
  umbral?: number
}

export interface StrategyTemplate {
  id: EntityId
  hipotesisId: EntityId
  nivel: StrategyLevel

  objetivo: string
  acciones: string[]
  horizonte: TimeHorizon
  responsableSugerido: string

  minConfianza: number
  maxConfianza?: number
  minPrioridad: PriorityLevel

  indicadoresConfirmacion: TrackingIndicator[]
  indicadoresCierre: TrackingIndicator[]

  version: string
  activa: boolean
}

export const STRATEGY_LIBRARY: StrategyTemplate[] = [
  // HIP-001: Estrés hídrico
  {
    id: 'STR-001-C',
    hipotesisId: 'HIP-001',
    nivel: 'conservadora',
    objetivo: 'Monitorear evolución sin intervención inmediata',
    acciones: [
      'Aumentar frecuencia de observación a 24h',
      'Programar próximo informe en 7 días',
    ],
    horizonte: 'corto_plazo',
    responsableSugerido: 'Equipo de monitoreo',
    minConfianza: 50,
    minPrioridad: 'media',
    indicadoresConfirmacion: [
      { variableId: 'rainfall_anomaly', condicion: 'mejora', ventana: '7d' },
      { variableId: 'ndvi', condicion: 'estabiliza', ventana: '7d' },
    ],
    indicadoresCierre: [
      { variableId: 'ndvi', condicion: 'mejora', ventana: '14d', umbral: 5 },
      { variableId: 'rainfall_anomaly', condicion: 'normaliza', ventana: '14d' },
    ],
    version: '1.0',
    activa: true,
  },
  {
    id: 'STR-001-B',
    hipotesisId: 'HIP-001',
    nivel: 'balanceada',
    objetivo: 'Validar en campo y activar protocolo preventivo',
    acciones: [
      'Despachar equipo de verificación',
      'Activar protocolo de sequía regional',
      'Notificar a MAGA',
    ],
    horizonte: 'inmediato',
    responsableSugerido: 'MAGA / Secretaría de Agricultura',
    minConfianza: 60,
    minPrioridad: 'alta',
    indicadoresConfirmacion: [
      { variableId: 'soil_moisture', condicion: 'empeora', ventana: '7d' },
    ],
    indicadoresCierre: [
      { variableId: 'ndvi', condicion: 'estabiliza', ventana: '14d' },
    ],
    version: '1.0',
    activa: true,
  },
  {
    id: 'STR-001-I',
    hipotesisId: 'HIP-001',
    nivel: 'intensiva',
    objetivo: 'Respuesta de emergencia ante sequía confirmada',
    acciones: [
      'Solicitar declaratoria de emergencia',
      'Despachar equipos multidisciplinarios',
      'Activar distribución de agua de emergencia',
    ],
    horizonte: 'inmediato',
    responsableSugerido: 'CONRED / Presidencia',
    minConfianza: 85,
    minPrioridad: 'critica',
    indicadoresConfirmacion: [
      { variableId: 'rainfall_anomaly', condicion: 'empeora', ventana: '14d', umbral: -50 },
    ],
    indicadoresCierre: [
      { variableId: 'rainfall_anomaly', condicion: 'normaliza', ventana: '30d' },
    ],
    version: '1.0',
    activa: true,
  },
  // HIP-003: Incendio
  {
    id: 'STR-003-C',
    hipotesisId: 'HIP-003',
    nivel: 'conservadora',
    objetivo: 'Monitorear focos detectados',
    acciones: [
      'Monitorear propagación cada 3h',
      'Solicitar imágenes de alta resolución',
    ],
    horizonte: 'inmediato',
    responsableSugerido: 'CONRED',
    minConfianza: 50,
    minPrioridad: 'media',
    indicadoresConfirmacion: [
      { variableId: 'fire_count', condicion: 'empeora', ventana: '3d' },
    ],
    indicadoresCierre: [
      { variableId: 'fire_count', condicion: 'normaliza', ventana: '7d' },
    ],
    version: '1.0',
    activa: true,
  },
  {
    id: 'STR-003-B',
    hipotesisId: 'HIP-003',
    nivel: 'balanceada',
    objetivo: 'Activar respuesta coordinada',
    acciones: [
      'Notificar CONRED',
      'Coordinar con bomberos locales',
      'Establecer perímetro de monitoreo',
    ],
    horizonte: 'inmediato',
    responsableSugerido: 'CONRED / Bomberos',
    minConfianza: 70,
    minPrioridad: 'alta',
    indicadoresConfirmacion: [],
    indicadoresCierre: [
      { variableId: 'fire_radiative_power', condicion: 'normaliza', ventana: '3d' },
    ],
    version: '1.0',
    activa: true,
  },
  {
    id: 'STR-003-I',
    hipotesisId: 'HIP-003',
    nivel: 'intensiva',
    objetivo: 'Respuesta de emergencia ante incendio activo',
    acciones: [
      'Solicitar apoyo aéreo',
      'Evacuar zonas de riesgo',
      'Activar centro de operaciones de emergencia',
    ],
    horizonte: 'inmediato',
    responsableSugerido: 'CONRED / Presidencia',
    minConfianza: 85,
    minPrioridad: 'critica',
    indicadoresConfirmacion: [],
    indicadoresCierre: [
      { variableId: 'fire_count', condicion: 'normaliza', ventana: '7d' },
    ],
    version: '1.0',
    activa: true,
  },
  // HIP-006: Causa no determinada
  {
    id: 'STR-006-U',
    hipotesisId: 'HIP-006',
    nivel: 'conservadora',
    objetivo: 'Investigar antes de actuar',
    acciones: [
      'Solicitar imagen satelital sin nubes',
      'Programar verificación en campo',
      'Re-evaluar en 48h',
    ],
    horizonte: 'inmediato',
    responsableSugerido: 'Equipo de investigación',
    minConfianza: 0,
    minPrioridad: 'baja',
    indicadoresConfirmacion: [],
    indicadoresCierre: [],
    version: '1.0',
    activa: true,
  },
]

export function getStrategiesForHypothesis(hipotesisId: EntityId): StrategyTemplate[] {
  return STRATEGY_LIBRARY.filter((s) => s.hipotesisId === hipotesisId && s.activa)
}

export function getStrategyByLevel(
  hipotesisId: EntityId,
  nivel: StrategyLevel,
): StrategyTemplate | undefined {
  return STRATEGY_LIBRARY.find((s) => s.hipotesisId === hipotesisId && s.nivel === nivel)
}
