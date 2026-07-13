import type {
  NewsGeographicStatus,
  NewsLocationCandidate,
  NewsPrimaryLocation,
} from '../types/news.types'

export const GEOLOCATOR_VERSION = 'preliminary-geo.v2'

export interface GuatemalaDepartment {
  code: string
  name: string
  latitude: number
  longitude: number
}

/** Catálogo territorial (ADM1) con centroides aproximados. */
export const GUATEMALA_DEPARTMENTS: GuatemalaDepartment[] = [
  { code: '01', name: 'Guatemala', latitude: 14.5789, longitude: -90.4529 },
  { code: '02', name: 'El Progreso', latitude: 14.9106, longitude: -90.0681 },
  { code: '03', name: 'Sacatepéquez', latitude: 14.5586, longitude: -90.7335 },
  { code: '04', name: 'Chimaltenango', latitude: 14.6566, longitude: -90.9291 },
  { code: '05', name: 'Escuintla', latitude: 14.1907, longitude: -91.0275 },
  { code: '06', name: 'Santa Rosa', latitude: 14.3881, longitude: -90.2956 },
  { code: '07', name: 'Sololá', latitude: 14.7733, longitude: -91.1833 },
  { code: '08', name: 'Totonicapán', latitude: 14.9117, longitude: -91.3611 },
  { code: '09', name: 'Quetzaltenango', latitude: 14.8589, longitude: -91.6 },
  { code: '10', name: 'Suchitepéquez', latitude: 14.5308, longitude: -91.4167 },
  { code: '11', name: 'Retalhuleu', latitude: 14.5333, longitude: -91.6833 },
  { code: '12', name: 'San Marcos', latitude: 14.9653, longitude: -91.7944 },
  { code: '13', name: 'Huehuetenango', latitude: 15.6064, longitude: -91.6445 },
  { code: '14', name: 'Quiché', latitude: 15.4283, longitude: -91.0076 },
  { code: '15', name: 'Baja Verapaz', latitude: 15.1111, longitude: -90.4121 },
  { code: '16', name: 'Alta Verapaz', latitude: 15.5956, longitude: -90.0911 },
  { code: '17', name: 'Petén', latitude: 16.8322, longitude: -90.0457 },
  { code: '18', name: 'Izabal', latitude: 15.517, longitude: -88.7251 },
  { code: '19', name: 'Zacapa', latitude: 15.0833, longitude: -89.5333 },
  { code: '20', name: 'Chiquimula', latitude: 14.6763, longitude: -89.3982 },
  { code: '21', name: 'Jalapa', latitude: 14.6478, longitude: -89.9464 },
  { code: '22', name: 'Jutiapa', latitude: 14.1486, longitude: -89.8942 },
]

const DEPT_BY_CODE = new Map(GUATEMALA_DEPARTMENTS.map((d) => [d.code, d]))

/**
 * Municipios/lugares específicos conocidos → departamento.
 * Nunca incluimos "Guatemala" a secas: comparte nombre con el país.
 * `label` es el nombre visible (con acentos) para la UI.
 */
const KNOWN_PLACES: Array<{ term: string; label: string; deptCode: string; specific: boolean }> = [
  // Guatemala (01) — solo señales de ciudad/municipio, no la palabra "Guatemala"
  { term: 'ciudad de guatemala', label: 'Ciudad de Guatemala', deptCode: '01', specific: true },
  { term: 'mixco', label: 'Mixco', deptCode: '01', specific: true },
  { term: 'villa nueva', label: 'Villa Nueva', deptCode: '01', specific: true },
  { term: 'villa canales', label: 'Villa Canales', deptCode: '01', specific: true },
  { term: 'san miguel petapa', label: 'San Miguel Petapa', deptCode: '01', specific: true },
  { term: 'santa catarina pinula', label: 'Santa Catarina Pinula', deptCode: '01', specific: true },
  { term: 'san jose pinula', label: 'San José Pinula', deptCode: '01', specific: true },
  { term: 'san juan sacatepequez', label: 'San Juan Sacatepéquez', deptCode: '01', specific: true },
  { term: 'chinautla', label: 'Chinautla', deptCode: '01', specific: true },
  { term: 'amatitlan', label: 'Amatitlán', deptCode: '01', specific: true },
  { term: 'fraijanes', label: 'Fraijanes', deptCode: '01', specific: true },
  { term: 'palencia', label: 'Palencia', deptCode: '01', specific: true },
  { term: 'vista hermosa', label: 'Vista Hermosa', deptCode: '01', specific: false },
  // El Progreso (02)
  { term: 'guastatoya', label: 'Guastatoya', deptCode: '02', specific: true },
  // Sacatepéquez (03)
  { term: 'antigua guatemala', label: 'Antigua Guatemala', deptCode: '03', specific: true },
  { term: 'ciudad vieja', label: 'Ciudad Vieja', deptCode: '03', specific: true },
  { term: 'jocotenango', label: 'Jocotenango', deptCode: '03', specific: true },
  { term: 'sumpango', label: 'Sumpango', deptCode: '03', specific: true },
  { term: 'sacatepequez', label: 'Sacatepéquez', deptCode: '03', specific: false },
  // Chimaltenango (04)
  { term: 'chimaltenango', label: 'Chimaltenango', deptCode: '04', specific: false },
  { term: 'tecpan', label: 'Tecpán', deptCode: '04', specific: true },
  // Escuintla (05)
  { term: 'escuintla', label: 'Escuintla', deptCode: '05', specific: false },
  { term: 'puerto quetzal', label: 'Puerto Quetzal', deptCode: '05', specific: true },
  { term: 'santa lucia cotzumalguapa', label: 'Santa Lucía Cotzumalguapa', deptCode: '05', specific: true },
  { term: 'palin', label: 'Palín', deptCode: '05', specific: true },
  { term: 'tiquisate', label: 'Tiquisate', deptCode: '05', specific: true },
  // Santa Rosa (06)
  { term: 'cuilapa', label: 'Cuilapa', deptCode: '06', specific: true },
  { term: 'barberena', label: 'Barberena', deptCode: '06', specific: true },
  // Sololá (07)
  { term: 'solola', label: 'Sololá', deptCode: '07', specific: false },
  { term: 'panajachel', label: 'Panajachel', deptCode: '07', specific: true },
  { term: 'santiago atitlan', label: 'Santiago Atitlán', deptCode: '07', specific: true },
  { term: 'san pedro la laguna', label: 'San Pedro La Laguna', deptCode: '07', specific: true },
  { term: 'lago de atitlan', label: 'Lago de Atitlán', deptCode: '07', specific: true },
  // Totonicapán (08)
  { term: 'totonicapan', label: 'Totonicapán', deptCode: '08', specific: false },
  // Quetzaltenango (09)
  { term: 'quetzaltenango', label: 'Quetzaltenango', deptCode: '09', specific: false },
  { term: 'xela', label: 'Quetzaltenango (Xela)', deptCode: '09', specific: true },
  { term: 'xelaju', label: 'Quetzaltenango (Xela)', deptCode: '09', specific: true },
  { term: 'coatepeque', label: 'Coatepeque', deptCode: '09', specific: true },
  // Suchitepéquez (10)
  { term: 'mazatenango', label: 'Mazatenango', deptCode: '10', specific: true },
  { term: 'suchitepequez', label: 'Suchitepéquez', deptCode: '10', specific: false },
  // Retalhuleu (11)
  { term: 'retalhuleu', label: 'Retalhuleu', deptCode: '11', specific: false },
  { term: 'reu', label: 'Retalhuleu', deptCode: '11', specific: true },
  // San Marcos (12)
  { term: 'san marcos', label: 'San Marcos', deptCode: '12', specific: false },
  { term: 'malacatan', label: 'Malacatán', deptCode: '12', specific: true },
  { term: 'tecun uman', label: 'Tecún Umán', deptCode: '12', specific: true },
  // Huehuetenango (13)
  { term: 'huehuetenango', label: 'Huehuetenango', deptCode: '13', specific: false },
  { term: 'huehue', label: 'Huehuetenango', deptCode: '13', specific: true },
  // Quiché (14)
  { term: 'quiche', label: 'Quiché', deptCode: '14', specific: false },
  { term: 'santa cruz del quiche', label: 'Santa Cruz del Quiché', deptCode: '14', specific: true },
  { term: 'chichicastenango', label: 'Chichicastenango', deptCode: '14', specific: true },
  { term: 'nebaj', label: 'Nebaj', deptCode: '14', specific: true },
  { term: 'ixcan', label: 'Ixcán', deptCode: '14', specific: true },
  // Baja Verapaz (15)
  { term: 'salama', label: 'Salamá', deptCode: '15', specific: true },
  { term: 'baja verapaz', label: 'Baja Verapaz', deptCode: '15', specific: false },
  { term: 'rabinal', label: 'Rabinal', deptCode: '15', specific: true },
  // Alta Verapaz (16)
  { term: 'alta verapaz', label: 'Alta Verapaz', deptCode: '16', specific: false },
  { term: 'coban', label: 'Cobán', deptCode: '16', specific: true },
  { term: 'fray bartolome de las casas', label: 'Fray Bartolomé de las Casas', deptCode: '16', specific: true },
  { term: 'fray bartolome', label: 'Fray Bartolomé de las Casas', deptCode: '16', specific: true },
  { term: 'san pedro carcha', label: 'San Pedro Carchá', deptCode: '16', specific: true },
  // Petén (17)
  { term: 'peten', label: 'Petén', deptCode: '17', specific: false },
  { term: 'flores', label: 'Flores', deptCode: '17', specific: true },
  { term: 'tikal', label: 'Tikal', deptCode: '17', specific: true },
  { term: 'san benito', label: 'San Benito', deptCode: '17', specific: true },
  { term: 'sayaxche', label: 'Sayaxché', deptCode: '17', specific: true },
  { term: 'poptun', label: 'Poptún', deptCode: '17', specific: true },
  { term: 'melchor de mencos', label: 'Melchor de Mencos', deptCode: '17', specific: true },
  { term: 'biosfera maya', label: 'Reserva de la Biosfera Maya', deptCode: '17', specific: true },
  // Izabal (18)
  { term: 'izabal', label: 'Izabal', deptCode: '18', specific: false },
  { term: 'puerto barrios', label: 'Puerto Barrios', deptCode: '18', specific: true },
  { term: 'livingston', label: 'Lívingston', deptCode: '18', specific: true },
  { term: 'rio dulce', label: 'Río Dulce', deptCode: '18', specific: true },
  { term: 'morales izabal', label: 'Morales', deptCode: '18', specific: true },
  // Zacapa (19)
  { term: 'zacapa', label: 'Zacapa', deptCode: '19', specific: false },
  { term: 'estanzuela', label: 'Estanzuela', deptCode: '19', specific: true },
  // Chiquimula (20)
  { term: 'chiquimula', label: 'Chiquimula', deptCode: '20', specific: false },
  { term: 'esquipulas', label: 'Esquipulas', deptCode: '20', specific: true },
  // Jalapa (21)
  { term: 'jalapa', label: 'Jalapa', deptCode: '21', specific: false },
  // Jutiapa (22)
  { term: 'jutiapa', label: 'Jutiapa', deptCode: '22', specific: false },
]

/** Marcadores que denotan alcance nacional (sin punto específico). */
const NATIONAL_MARKERS = [
  'a nivel nacional',
  'nivel nacional',
  'en todo el pais',
  'todo el pais',
  'en el pais',
  'los guatemaltecos',
  'las y los guatemaltecos',
  'territorio nacional',
]

/** Instituciones/temas de cobertura nacional: no son lugares. */
const NATIONAL_SUBJECTS = [
  'conred',
  'insivumeh',
  'mspas',
  'ministerio de salud',
  'mingob',
  'ministerio de gobernacion',
  'pnc',
  'policia nacional civil',
  'igss',
  'sat',
  'congreso',
  'gobierno de guatemala',
  'pronostico del clima',
  'canicula',
  'temporada de lluvias',
  'ministerio publico',
]

/** Locativos que indican que el hecho principal ocurre en el extranjero. */
const FOREIGN_LOCATIVES = [
  'en estados unidos',
  'en eeuu',
  'en florida',
  'en miami',
  'en los angeles',
  'en nueva york',
  'en california',
  'en texas',
  'en mexico',
  'en tapachula',
  'en honduras',
  'en el salvador',
  'en nicaragua',
  'en espana',
  'en madrid',
  'en washington',
]

/** Marcadores fuertes de hecho ocurrido en el extranjero (migración/justicia). */
const STRONG_INTERNATIONAL_MARKERS = [
  'culpable en eeuu',
  'culpable en estados unidos',
  'detenido por ice',
  'arrestado por ice',
  'corte federal',
  'deportado desde',
  'extraditado a',
]

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    // Colapsar variantes de "EE. UU." / "EE.UU." / "ee uu" → "eeuu".
    .replace(/\bee\.?\s*uu\.?/g, 'eeuu')
}

/** Coincidencia por límite de palabra sobre texto normalizado (sin acentos). */
function containsTerm(normalizedText: string, normalizedTerm: string): boolean {
  return matchTermIndex(normalizedText, normalizedTerm) >= 0
}

/** Índice de coincidencia (con límite de palabra) o -1 si no aparece. */
function matchTermIndex(normalizedText: string, normalizedTerm: string): number {
  if (!normalizedTerm) return -1
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^a-z0-9])(${escaped})([^a-z0-9]|$)`, 'i')
  const found = re.exec(normalizedText)
  if (!found) return -1
  return found.index + found[1].length
}

function evidenceSnippet(normalizedText: string, normalizedTerm: string): string {
  const idx = matchTermIndex(normalizedText, normalizedTerm)
  if (idx < 0) return normalizedTerm
  return normalizedText.slice(Math.max(0, idx - 20), idx + normalizedTerm.length + 25).trim()
}

export interface GeographyResult {
  geographicStatus: NewsGeographicStatus
  primaryLocation: NewsPrimaryLocation | null
  locationCandidates: NewsLocationCandidate[]
  version: string
  reason: string
}

export function inferPreliminaryGeography(input: {
  title?: string | null
  subtitle?: string | null
  description?: string | null
  sourceCategory?: string | null
  urlPath?: string
}): GeographyResult {
  const corpus = [input.title, input.subtitle, input.description]
    .filter(Boolean)
    .join(' . ')
  const norm = normalizeText(corpus)

  // ---------------------------------------------------------------------
  // 1. Detectar lugares sub-nacionales concretos (municipios, zonas, dept.)
  //    Se procesan los términos de mayor a menor longitud y se descartan las
  //    coincidencias contenidas dentro de otra ya aceptada (p. ej.
  //    "sacatepequez" dentro de "san juan sacatepequez").
  // ---------------------------------------------------------------------
  const candidateByDept = new Map<string, NewsLocationCandidate>()
  const acceptedSpans: Array<[number, number]> = []
  const orderedPlaces = [...KNOWN_PLACES].sort((a, b) => b.term.length - a.term.length)

  for (const place of orderedPlaces) {
    const idx = matchTermIndex(norm, place.term)
    if (idx < 0) continue
    const span: [number, number] = [idx, idx + place.term.length]
    const containedInLonger = acceptedSpans.some(([s, e]) => idx >= s && span[1] <= e)
    if (containedInLonger) continue
    acceptedSpans.push(span)

    const dept = DEPT_BY_CODE.get(place.deptCode)!
    const confidence = place.specific ? 0.8 : 0.6
    const prev = candidateByDept.get(place.deptCode)
    if (!prev || confidence > prev.confidence) {
      candidateByDept.set(place.deptCode, {
        name: place.label,
        departmentCode: dept.code,
        departmentName: dept.name,
        municipalityName: place.specific ? place.label : undefined,
        latitude: dept.latitude,
        longitude: dept.longitude,
        confidence,
        evidence: evidenceSnippet(norm, place.term),
        level: place.specific ? 'approximate' : 'department',
      })
    }
  }

  // Zonas de la capital ("zona 15", "zona 18") → Guatemala (01), señal fuerte.
  const zoneMatch = /\bzona\s+(\d{1,2})\b/i.exec(corpus)
  if (zoneMatch) {
    const dept = DEPT_BY_CODE.get('01')!
    const prev = candidateByDept.get('01')
    if (!prev || prev.confidence < 0.85) {
      candidateByDept.set('01', {
        name: `Zona ${zoneMatch[1]}, Ciudad de Guatemala`,
        departmentCode: '01',
        departmentName: dept.name,
        municipalityName: 'Ciudad de Guatemala',
        latitude: dept.latitude,
        longitude: dept.longitude,
        confidence: 0.85,
        evidence: zoneMatch[0],
        level: 'exact',
      })
    }
  }

  const candidates = [...candidateByDept.values()].sort((a, b) => b.confidence - a.confidence)

  // ---------------------------------------------------------------------
  // 2. Internacional: el hecho principal ocurre en el extranjero.
  //    Se aplica si hay señal internacional y NO hay un lugar guatemalteco
  //    concreto (nivel exacto o municipio). Una mención de departamento suelta
  //    (p. ej. el origen de una persona) no bloquea la clasificación.
  // ---------------------------------------------------------------------
  const hasForeignLocative = FOREIGN_LOCATIVES.some((f) => containsTerm(norm, f))
  const hasStrongIntl = STRONG_INTERNATIONAL_MARKERS.some((f) => containsTerm(norm, f))
  const hasSpecificDomestic = candidates.some(
    (c) => c.level === 'exact' || c.level === 'approximate',
  )
  if ((hasForeignLocative || hasStrongIntl) && !hasSpecificDomestic) {
    return {
      geographicStatus: 'internacional',
      primaryLocation: { name: 'Internacional', confidence: 0.6, level: 'international' },
      locationCandidates: [],
      version: GEOLOCATOR_VERSION,
      reason: hasStrongIntl
        ? 'Hecho ocurrido en el extranjero (marcador fuerte)'
        : 'Locativo extranjero sin lugar guatemalteco concreto',
    }
  }

  // ---------------------------------------------------------------------
  // 3. Lugares concretos encontrados
  // ---------------------------------------------------------------------
  if (candidates.length >= 2) {
    return {
      geographicStatus: 'varias_ubicaciones',
      primaryLocation: { ...candidates[0]!, level: 'approximate' },
      locationCandidates: candidates,
      version: GEOLOCATOR_VERSION,
      reason: `Dos o más departamentos mencionados (${candidates.length})`,
    }
  }

  if (candidates.length === 1) {
    const primary = candidates[0]!
    const isExact = primary.level === 'exact'
    return {
      geographicStatus: isExact ? 'localizada' : 'ubicacion_aproximada',
      primaryLocation: { ...primary },
      locationCandidates: candidates,
      version: GEOLOCATOR_VERSION,
      reason: isExact ? 'Lugar puntual (zona/ciudad)' : 'Un departamento identificado',
    }
  }

  // ---------------------------------------------------------------------
  // 4. Alcance nacional (sin lugar concreto)
  // ---------------------------------------------------------------------
  const hasNationalMarker = NATIONAL_MARKERS.some((m) => containsTerm(norm, m))
  const hasNationalSubject = NATIONAL_SUBJECTS.some((s) => containsTerm(norm, s))
  const mentionsCountry = /\bguatemala\b/i.test(corpus)

  if (hasNationalMarker || hasNationalSubject || mentionsCountry) {
    const reason = hasNationalMarker
      ? 'Marcador de alcance nacional'
      : hasNationalSubject
        ? 'Institución/tema de cobertura nacional'
        : 'Referencia al país sin lugar sub-nacional'
    return {
      geographicStatus: 'nacional',
      primaryLocation: { name: 'Guatemala', confidence: 0.5, level: 'national' },
      locationCandidates: [],
      version: GEOLOCATOR_VERSION,
      reason,
    }
  }

  // ---------------------------------------------------------------------
  // 5. Evidencia insuficiente → Sin ubicación (preferible a inventar)
  // ---------------------------------------------------------------------
  return {
    geographicStatus: 'sin_ubicacion',
    primaryLocation: null,
    locationCandidates: [],
    version: GEOLOCATOR_VERSION,
    reason: 'Sin evidencia territorial suficiente',
  }
}
