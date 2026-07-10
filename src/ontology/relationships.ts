export type EntityType =
  | 'territorio'
  | 'observacion'
  | 'evento'
  | 'hallazgo'
  | 'hipotesis'
  | 'evidencia'
  | 'riesgo'
  | 'prioridad'
  | 'estrategia'
  | 'reporte'
  | 'expediente'
  | 'variable'
  | 'fuente'
  | 'regla'

export type RelationType =
  | 'contiene'
  | 'produce'
  | 'dispara'
  | 'compone'
  | 'respalda'
  | 'contradice'
  | 'explica'
  | 'evalua'
  | 'prioriza'
  | 'recomienda'
  | 'documenta'
  | 'referencia'

export interface OntologyRelation {
  from: EntityType
  to: EntityType
  type: RelationType
  cardinality: '1:1' | '1:N' | 'N:1' | 'N:M'
  description: string
}

export const ONTOLOGY_RELATIONS: OntologyRelation[] = [
  { from: 'territorio', to: 'observacion', type: 'contiene', cardinality: '1:N', description: 'Un territorio contiene muchas observaciones' },
  { from: 'territorio', to: 'evento', type: 'contiene', cardinality: '1:N', description: 'Un territorio contiene muchos eventos' },
  { from: 'territorio', to: 'hallazgo', type: 'contiene', cardinality: '1:N', description: 'Un territorio contiene muchos hallazgos' },
  { from: 'variable', to: 'observacion', type: 'referencia', cardinality: '1:N', description: 'Una variable define el significado de muchas observaciones' },
  { from: 'fuente', to: 'observacion', type: 'produce', cardinality: '1:N', description: 'Una fuente produce muchas observaciones' },
  { from: 'observacion', to: 'evento', type: 'dispara', cardinality: 'N:M', description: 'Observaciones disparan eventos via reglas' },
  { from: 'evento', to: 'hallazgo', type: 'compone', cardinality: 'N:M', description: 'Eventos correlacionados componen un hallazgo' },
  { from: 'hallazgo', to: 'expediente', type: 'documenta', cardinality: '1:1', description: 'Cada hallazgo tiene exactamente un expediente' },
  { from: 'hallazgo', to: 'hipotesis', type: 'explica', cardinality: '1:N', description: 'Un hallazgo puede tener múltiples hipótesis' },
  { from: 'evidencia', to: 'hallazgo', type: 'respalda', cardinality: 'N:1', description: 'Evidencia respalda un hallazgo' },
  { from: 'evidencia', to: 'hipotesis', type: 'respalda', cardinality: 'N:1', description: 'Evidencia respalda o contradice una hipótesis' },
  { from: 'riesgo', to: 'hallazgo', type: 'evalua', cardinality: '1:1', description: 'Un riesgo evalúa un hallazgo' },
  { from: 'prioridad', to: 'hallazgo', type: 'prioriza', cardinality: '1:1', description: 'Una prioridad se asigna a un hallazgo' },
  { from: 'estrategia', to: 'hallazgo', type: 'recomienda', cardinality: 'N:1', description: 'Estrategias se derivan de un hallazgo' },
  { from: 'reporte', to: 'hallazgo', type: 'referencia', cardinality: 'N:M', description: 'Un reporte compila múltiples hallazgos' },
  { from: 'regla', to: 'evento', type: 'dispara', cardinality: '1:N', description: 'Reglas de detección crean eventos' },
  { from: 'regla', to: 'hipotesis', type: 'explica', cardinality: '1:N', description: 'Reglas de hipótesis generan explicaciones' },
]

export function getRelationsFor(entity: EntityType): OntologyRelation[] {
  return ONTOLOGY_RELATIONS.filter((r) => r.from === entity || r.to === entity)
}

export function getRelatedEntities(entity: EntityType): EntityType[] {
  const related = new Set<EntityType>()
  for (const r of ONTOLOGY_RELATIONS) {
    if (r.from === entity) related.add(r.to)
    if (r.to === entity) related.add(r.from)
  }
  return [...related]
}
