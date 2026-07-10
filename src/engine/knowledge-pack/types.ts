import type { EntityId } from '@/ontology/primitives'

export type KnowledgeEntityType =
  | 'cultivo'
  | 'ecosistema'
  | 'fenomeno'
  | 'protocolo'
  | 'institucion'

export interface FenologiaPhase {
  fase: string
  dias: string
  ndviEsperado?: string
  descripcion?: string
}

export interface KnowledgeEntity {
  id: EntityId
  tipo: KnowledgeEntityType
  nombre: string
  atributos: Record<string, unknown>
  fenologia?: FenologiaPhase[]
  rangosNormales?: Record<string, { min: number; max: number }>
  riesgos?: string[]
  indicadoresCriticos?: EntityId[]
  bibliografia?: string[]
}

export interface KnowledgeRelation {
  from: EntityId
  to: EntityId
  tipo: string
  descripcion?: string
}

export interface KnowledgePack {
  id: EntityId
  nombre: string
  version: string
  dominio: string
  territorioIds: EntityId[]

  entidades: KnowledgeEntity[]
  relaciones: KnowledgeRelation[]
  reglas: EntityId[]
  variables: EntityId[]
  hipotesis: EntityId[]
}

export const AGRICULTURE_PACK_GT: KnowledgePack = {
  id: 'agricultura-gt',
  nombre: 'Agricultura Guatemala',
  version: '0.1',
  dominio: 'agricultura',
  territorioIds: ['GT'],
  entidades: [
    {
      id: 'cultivo-maiz',
      tipo: 'cultivo',
      nombre: 'Maíz',
      atributos: {
        cicloDias: 120,
        temporadaSiembra: 'mayo-junio',
        temporadaCosecha: 'octubre-noviembre',
        departamentosPrincipales: ['GT-16', 'GT-20', 'GT-21'],
      },
      fenologia: [
        { fase: 'siembra', dias: '0-15', ndviEsperado: '0.2-0.4' },
        { fase: 'crecimiento', dias: '15-60', ndviEsperado: '0.5-0.8' },
        { fase: 'floración', dias: '60-90', ndviEsperado: '0.7-0.85' },
        { fase: 'maduración', dias: '90-120', ndviEsperado: '0.4-0.6' },
      ],
      rangosNormales: {
        rainfall_daily: { min: 3, max: 15 },
        temperature: { min: 18, max: 32 },
      },
      riesgos: ['sequía', 'exceso_humedad', 'granizada', 'plaga'],
      indicadoresCriticos: ['ndvi', 'rainfall_anomaly', 'temperature_anomaly'],
    },
    {
      id: 'cultivo-cafe',
      tipo: 'cultivo',
      nombre: 'Café',
      atributos: {
        cicloDias: 365,
        altitudOptima: '800-1600m',
        departamentosPrincipales: ['GT-09', 'GT-13', 'GT-15'],
      },
      riesgos: ['sequía', 'roya', 'granizada', 'helada'],
      indicadoresCriticos: ['ndvi', 'ndmi', 'rainfall_anomaly', 'temperature'],
    },
  ],
  relaciones: [
    {
      from: 'cultivo-maiz',
      to: 'ndvi',
      tipo: 'depende_de',
      descripcion: 'NDVI es indicador crítico del ciclo del maíz',
    },
    {
      from: 'cultivo-maiz',
      to: 'rainfall_anomaly',
      tipo: 'depende_de',
      descripcion: 'Precipitación determina rendimiento del maíz',
    },
  ],
  reglas: ['R-COR-001', 'R-HIP-001'],
  variables: ['ndvi', 'rainfall_anomaly', 'temperature_anomaly', 'ndmi'],
  hipotesis: ['HIP-001', 'HIP-005'],
}

export const KNOWLEDGE_PACKS: KnowledgePack[] = [AGRICULTURE_PACK_GT]

export function getKnowledgePack(id: EntityId): KnowledgePack | undefined {
  return KNOWLEDGE_PACKS.find((p) => p.id === id)
}
