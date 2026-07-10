import type { EntityId } from '@/ontology/primitives'
import type { ConditionOperator } from '@/ontology/rule-engine/types'

export interface HypothesisCondition {
  variableId?: EntityId
  eventoTipo?: string
  operador: ConditionOperator
  valor?: number | string
  ventana?: string
}

export interface HypothesisTemplate {
  id: EntityId
  nombre: string
  descripcion: string
  categoria: string

  condicionesRequeridas: HypothesisCondition[]
  condicionesOpcionales: HypothesisCondition[]
  condicionesRefutacion: HypothesisCondition[]

  variables: EntityId[]
  dominios: string[]

  version: string
  activa: boolean
  bibliografia?: string[]
}

export const HYPOTHESIS_LIBRARY: HypothesisTemplate[] = [
  {
    id: 'HIP-001',
    nombre: 'Estrés hídrico',
    descripcion: 'Déficit de agua como causa principal del deterioro vegetativo',
    categoria: 'vegetacion',
    condicionesRequeridas: [
      { variableId: 'rainfall_anomaly', operador: '<', valor: -20, ventana: '30d' },
      { eventoTipo: 'ndvi_drop', operador: 'existe', ventana: '16d' },
    ],
    condicionesOpcionales: [
      { variableId: 'temperature_anomaly', operador: '>', valor: 2 },
      { variableId: 'ndmi', operador: 'cambio_%', valor: -10 },
    ],
    condicionesRefutacion: [
      { variableId: 'rainfall_anomaly', operador: 'dentro_rango', valor: 15 },
    ],
    variables: ['ndvi', 'rainfall_anomaly', 'temperature_anomaly', 'ndmi'],
    dominios: ['agricultura', 'agua'],
    version: '1.0',
    activa: true,
  },
  {
    id: 'HIP-002',
    nombre: 'Exceso de humedad',
    descripcion: 'Exceso de precipitación afectando cultivos o infraestructura',
    categoria: 'hidrologico',
    condicionesRequeridas: [
      { variableId: 'rainfall_anomaly', operador: '>', valor: 50, ventana: '14d' },
    ],
    condicionesOpcionales: [
      { variableId: 'ndmi', operador: '>', valor: 0.3 },
    ],
    condicionesRefutacion: [
      { variableId: 'rainfall_anomaly', operador: 'dentro_rango', valor: 15 },
    ],
    variables: ['rainfall_anomaly', 'ndmi', 'soil_moisture'],
    dominios: ['agricultura', 'agua'],
    version: '1.0',
    activa: true,
  },
  {
    id: 'HIP-003',
    nombre: 'Incendio',
    descripcion: 'Foco de calor activo con riesgo de propagación',
    categoria: 'incendio',
    condicionesRequeridas: [
      { variableId: 'fire_radiative_power', operador: '>', valor: 0 },
    ],
    condicionesOpcionales: [
      { variableId: 'temperature_anomaly', operador: '>', valor: 2 },
      { eventoTipo: 'ndvi_drop', operador: 'existe', ventana: '7d' },
    ],
    condicionesRefutacion: [
      { variableId: 'fire_count', operador: '==', valor: 0, ventana: '7d' },
    ],
    variables: ['fire_radiative_power', 'fire_count', 'temperature_anomaly', 'ndvi'],
    dominios: ['incendios', 'bosques'],
    version: '1.0',
    activa: true,
  },
  {
    id: 'HIP-004',
    nombre: 'Inundación',
    descripcion: 'Precipitación extrema con riesgo de inundación',
    categoria: 'hidrologico',
    condicionesRequeridas: [
      { variableId: 'rainfall_daily', operador: '>', valor: 50, ventana: '3d' },
    ],
    condicionesOpcionales: [
      { eventoTipo: 'official_alert', operador: 'existe' },
    ],
    condicionesRefutacion: [
      { variableId: 'rainfall_daily', operador: 'dentro_rango', valor: 30, ventana: '5d' },
    ],
    variables: ['rainfall_daily', 'rainfall_anomaly', 'official_alert'],
    dominios: ['agua', 'institucional'],
    version: '1.0',
    activa: true,
  },
  {
    id: 'HIP-005',
    nombre: 'Recuperación agrícola',
    descripcion: 'Vegetación en proceso de recuperación tras período de estrés',
    categoria: 'vegetacion',
    condicionesRequeridas: [
      { variableId: 'ndvi', operador: 'cambio_%', valor: 10, ventana: '16d' },
    ],
    condicionesOpcionales: [
      { variableId: 'rainfall_anomaly', operador: 'dentro_rango', valor: 15 },
    ],
    condicionesRefutacion: [
      { variableId: 'ndvi', operador: 'cambio_%', valor: -5, ventana: '16d' },
    ],
    variables: ['ndvi', 'rainfall_anomaly', 'evi'],
    dominios: ['agricultura'],
    version: '1.0',
    activa: true,
  },
  {
    id: 'HIP-006',
    nombre: 'Causa no determinada',
    descripcion: 'Señal detectada sin hipótesis causal clara — requiere investigación',
    categoria: 'compuesto',
    condicionesRequeridas: [],
    condicionesOpcionales: [],
    condicionesRefutacion: [],
    variables: [],
    dominios: [],
    version: '1.0',
    activa: true,
  },
  {
    id: 'HIP-007',
    nombre: 'Degradación por actividad humana',
    descripcion: 'Pérdida de vegetación sin correlación climática clara',
    categoria: 'socioambiental',
    condicionesRequeridas: [
      { eventoTipo: 'ndvi_drop', operador: 'existe', ventana: '16d' },
    ],
    condicionesOpcionales: [],
    condicionesRefutacion: [
      { eventoTipo: 'rainfall_deficit', operador: 'existe' },
    ],
    variables: ['ndvi', 'rainfall_anomaly'],
    dominios: ['bosques', 'socioambiental'],
    version: '1.0',
    activa: true,
  },
  {
    id: 'HIP-008',
    nombre: 'Ola de calor',
    descripcion: 'Temperaturas anómalamente altas sostenidas',
    categoria: 'climatico',
    condicionesRequeridas: [
      { variableId: 'temperature_anomaly', operador: '>', valor: 3, ventana: '5d' },
    ],
    condicionesOpcionales: [
      { variableId: 'humidity', operador: '<', valor: 30 },
    ],
    condicionesRefutacion: [
      { variableId: 'temperature_anomaly', operador: 'dentro_rango', valor: 2, ventana: '3d' },
    ],
    variables: ['temperature_anomaly', 'temperature', 'humidity'],
    dominios: ['clima', 'agricultura'],
    version: '1.0',
    activa: true,
  },
]

export function getHypothesisById(id: EntityId): HypothesisTemplate | undefined {
  return HYPOTHESIS_LIBRARY.find((h) => h.id === id)
}

export function getActiveHypotheses(): HypothesisTemplate[] {
  return HYPOTHESIS_LIBRARY.filter((h) => h.activa && h.id !== 'HIP-006')
}

export function getFallbackHypothesis(): HypothesisTemplate {
  return HYPOTHESIS_LIBRARY.find((h) => h.id === 'HIP-006')!
}
