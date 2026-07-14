/**
 * Validación de compatibilidad semántica de relaciones documentales.
 *
 * La IA propone relaciones sujeto → predicado → objeto. Estas reglas mínimas
 * y reutilizables detectan combinaciones incompatibles o que omiten un nodo
 * intermedio (p. ej. "persona → involucrado en → persona fallecida", que debería
 * pasar por el accidente). No inventan el nodo faltante: solo advierten/rechazan.
 */

export type EntityCategory =
  | 'person'
  | 'institution'
  | 'organization'
  | 'vehicle'
  | 'place'
  | 'source'
  | 'event'
  | 'decision'
  | 'consequence'
  | 'group'
  | 'infrastructure'
  | 'product'
  | 'unknown'

/** Normaliza el tipo de entidad (español/inglés) a una categoría canónica. */
export function classifyEntityCategory(entityType: string | null | undefined): EntityCategory {
  const t = (entityType ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  // El orden importa: los conceptos de hecho/decisión/consecuencia se evalúan
  // antes que "vehículo"/"lugar" para que "Accidente de autobús" sea un hecho.
  if (/event_occurrence|hecho|accidente|suceso|occurrence|incidente|colision|choque|volcadura/.test(t)) return 'event'
  if (/legal_resolution|resolucion|resolution|decision|fallo|sentencia|dictamen/.test(t)) return 'decision'
  if (/consequence|consecuencia|fallecimiento|muerte|deceso|dano|daño|lesion|herido/.test(t)) return 'consequence'
  if (/institu|ministerio|juzgad|tribunal|organismo|pnc|fiscal/.test(t)) return 'institution'
  if (/organizacion|organization|empresa|company|ong/.test(t)) return 'organization'
  if (/fuente|source|document_source|medio|prensa/.test(t)) return 'source'
  if (/vehicul|vehicle|autobus|bus|camion|carro|moto/.test(t)) return 'vehicle'
  if (/lugar|place|ciudad|city|zona|territorio|municip|departament|location/.test(t)) return 'place'
  if (/person|jueza?|piloto|conductor|victim|persona/.test(t)) return 'person'
  if (/group|grupo|cuantificad|poblacion|damnificad/.test(t)) return 'group'
  if (/infra|carretera|puente|ruta|via|road|bridge/.test(t)) return 'infrastructure'
  if (/product|producto|cultivo|bien/.test(t)) return 'product'
  return 'unknown'
}

type PredicateClass =
  | 'issued'
  | 'process_subject'
  | 'involved_in'
  | 'occurred_in'
  | 'involves'
  | 'has_consequence'
  | 'reported'
  | 'other'

function classifyPredicate(predicate: string): PredicateClass {
  const p = predicate.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  if (/dicto|dict[oa]|emiti|resolvi|orden|fallo|sentenci/.test(p)) return 'issued'
  if (/sujeto procesal|se refiere|refiere procesal|imput|proces[oa] a|benefici/.test(p)) return 'process_subject'
  if (/involucrad[oa] en|vinculad[oa] con|relacionad[oa] con|participo en/.test(p)) return 'involved_in'
  if (/ocurri[oó] en|sucedi[oó] en|ubicad[oa] en|tuvo lugar en|acaeci/.test(p)) return 'occurred_in'
  if (/involucr[oó]$|involucro |comprometi|afecto a|incluy/.test(p)) return 'involves'
  if (/consecuencia|deriv[oó]|resulto en|tuvo como consecuencia|provoco|causo/.test(p)) return 'has_consequence'
  if (/report|confirm|anunci|declar|informo|public/.test(p)) return 'reported'
  return 'other'
}

export interface RelationSemanticResult {
  status: 'ok' | 'suspicious' | 'invalid'
  code: string
  /** Mensaje humanizado en español. */
  message: string
}

const ALLOWED: Record<PredicateClass, { subject: EntityCategory[]; object: EntityCategory[] }> = {
  issued: {
    subject: ['person', 'institution', 'organization'],
    object: ['decision'],
  },
  process_subject: {
    subject: ['decision', 'institution'],
    object: ['person', 'organization', 'group'],
  },
  involved_in: {
    subject: ['person', 'vehicle', 'organization', 'group'],
    object: ['event'],
  },
  occurred_in: {
    subject: ['event'],
    object: ['place'],
  },
  involves: {
    subject: ['event'],
    object: ['person', 'vehicle', 'group', 'infrastructure', 'product'],
  },
  has_consequence: {
    subject: ['event', 'decision'],
    object: ['consequence', 'person', 'group', 'infrastructure'],
  },
  reported: {
    subject: ['source', 'person', 'institution', 'organization'],
    object: ['person', 'institution', 'organization', 'event', 'decision', 'consequence', 'place', 'vehicle', 'group', 'infrastructure', 'product', 'unknown'],
  },
  other: { subject: [], object: [] },
}

/**
 * Evalúa una relación. Devuelve 'invalid' para combinaciones claramente
 * incompatibles (se rechazan), 'suspicious' para las que probablemente omiten
 * un nodo intermedio (se advierten), u 'ok'.
 */
export function validateRelationSemantics(
  subjectCat: EntityCategory,
  predicate: string,
  objectCat: EntityCategory,
): RelationSemanticResult {
  const cls = classifyPredicate(predicate)

  // Regla ontológica clave: persona/vehículo "involucrado en" NO puede apuntar
  // directamente a una persona o a una consecuencia; falta el hecho central.
  if (cls === 'involved_in' && (objectCat === 'person' || objectCat === 'consequence')) {
    return {
      status: 'invalid',
      code: 'relation_missing_intermediate_event',
      message:
        'La relación omite el hecho intermedio: un participante debe vincularse con el hecho (p. ej. el accidente), no directamente con la víctima o la consecuencia.',
    }
  }

  // Una fuente documental no causa daños ni consecuencias.
  if (cls === 'has_consequence' && subjectCat === 'source') {
    return {
      status: 'invalid',
      code: 'relation_source_cannot_cause',
      message: 'Una fuente documental no puede figurar como causa de una consecuencia.',
    }
  }

  // Un lugar no dicta resoluciones.
  if (cls === 'issued' && (subjectCat === 'place' || subjectCat === 'vehicle' || subjectCat === 'source' || subjectCat === 'consequence')) {
    return {
      status: 'invalid',
      code: 'relation_invalid_issuer',
      message: 'El sujeto no puede emitir una resolución o decisión según su tipo.',
    }
  }

  if (cls === 'other') {
    return { status: 'ok', code: 'relation_unclassified', message: '' }
  }

  const allowed = ALLOWED[cls]
  const subjOk = allowed.subject.length === 0 || allowed.subject.includes(subjectCat) || subjectCat === 'unknown'
  const objOk = allowed.object.length === 0 || allowed.object.includes(objectCat) || objectCat === 'unknown'

  if (!subjOk || !objOk) {
    return {
      status: 'suspicious',
      code: 'relation_type_mismatch',
      message: 'La relación combina tipos poco compatibles; conviene revisar si falta un nodo intermedio.',
    }
  }

  return { status: 'ok', code: 'relation_ok', message: '' }
}
