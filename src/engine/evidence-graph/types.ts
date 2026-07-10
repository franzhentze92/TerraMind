import type { EntityId, ISODateTime } from '@/ontology/primitives'

export type GraphNodeType =
  | 'fuente'
  | 'variable'
  | 'observacion'
  | 'evento'
  | 'hallazgo'
  | 'hipotesis'
  | 'evidencia'
  | 'riesgo'
  | 'prioridad'
  | 'estrategia'
  | 'escenario'
  | 'expediente'
  | 'reporte'
  | 'regla'

export type GraphRelation =
  | 'produce'
  | 'mide'
  | 'ubicada_en'
  | 'dispara'
  | 'compone'
  | 'respalda'
  | 'soporta'
  | 'explica'
  | 'evalua'
  | 'prioriza'
  | 'recomienda'
  | 'proyecta'
  | 'documenta'
  | 'compila'
  | 'generada_por'
  | 'contiene'
  | 'contradice'

export interface GraphNode {
  id: string
  type: GraphNodeType
  entityId: EntityId
  label: string
  metadata: Record<string, unknown>
  createdAt: ISODateTime
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relation: GraphRelation
  weight?: number
  metadata: Record<string, unknown>
  createdAt: ISODateTime
}

export interface GraphPath {
  nodes: GraphNode[]
  edges: GraphEdge[]
  totalWeight: number
}

export interface TracedNode {
  node: GraphNode
  path: GraphEdge[]
  depth: number
}

export interface ConclusionTrace {
  hallazgo: GraphNode
  expediente: GraphNode
  cadena: {
    observaciones: TracedNode[]
    eventos: TracedNode[]
    evidenciaAFavor: TracedNode[]
    evidenciaEnContra: TracedNode[]
    hipotesis: TracedNode[]
    fuentes: TracedNode[]
    reglas: TracedNode[]
  }
  explicacion: string
}

export interface EvidenceGraph {
  readonly nodes: ReadonlyMap<string, GraphNode>
  readonly edges: ReadonlyMap<string, GraphEdge>

  addNode(node: GraphNode): void
  addEdge(edge: GraphEdge): void
  getNode(id: string): GraphNode | undefined
  getEdgesFrom(nodeId: string): GraphEdge[]
  getEdgesTo(nodeId: string): GraphEdge[]
  getPath(fromId: string, toId: string): GraphPath | null
  getAncestors(nodeId: string, maxDepth?: number): GraphNode[]
  getDescendants(nodeId: string, maxDepth?: number): GraphNode[]
  traceConclusion(hallazgoNodeId: string): ConclusionTrace
}

export function createNodeId(type: GraphNodeType, entityId: EntityId): string {
  const prefixes: Record<GraphNodeType, string> = {
    fuente: 'src',
    variable: 'var',
    observacion: 'obs',
    evento: 'evt',
    hallazgo: 'hal',
    hipotesis: 'hip',
    evidencia: 'evd',
    riesgo: 'rsk',
    prioridad: 'pri',
    estrategia: 'str',
    escenario: 'esc',
    expediente: 'exp',
    reporte: 'rep',
    regla: 'reg',
  }
  return `${prefixes[type]}:${entityId}`
}
