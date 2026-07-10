export const GENERIC_TERRITORIAL_LABELS = [
  'zona de amortiguamiento',
  'zona nucleo',
  'zona núcleo',
  'zona de uso multiple',
  'zona de usos multiples',
  'zona de uso múltiple',
  'zona de usos múltiples',
  'zona de recuperacion',
  'zona de recuperación',
  'area de proteccion especial',
  'área de protección especial',
] as const

export interface TerritorialNameFields {
  general_name?: string | null
  specific_name?: string | null
  general_category?: string | null
  specific_category?: string | null
}

function normalize(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

export function isGenericTerritorialName(name: string | null | undefined): boolean {
  const n = normalize(name)
  if (!n) return true
  return GENERIC_TERRITORIAL_LABELS.some(
    (label) => n === label || n.startsWith(`${label} `) || n.endsWith(` ${label}`),
  )
}

function isAbbreviatedParentName(
  generalName: string,
  specificCategory: string | null | undefined,
): boolean {
  const general = normalize(generalName)
  const category = normalize(specificCategory)
  if (!general || !category) return false
  const tokens = general.split(' ').filter(Boolean)
  if (tokens.length === 1 && category.includes(general) && category.length > general.length + 5) {
    return true
  }
  return false
}

function resolveParentAreaLabel(fields: TerritorialNameFields): string {
  const general = fields.general_name?.trim() || ''
  const specificCategory = fields.specific_category?.trim() || ''
  const generalCategory = fields.general_category?.trim() || ''

  if (
    general &&
    !isGenericTerritorialName(general) &&
    !isAbbreviatedParentName(general, specificCategory)
  ) {
    return general
  }

  if (specificCategory && !isGenericTerritorialName(specificCategory)) {
    return specificCategory
  }

  if (generalCategory && general) {
    const combined = `${generalCategory} ${general}`.trim()
    if (!isGenericTerritorialName(combined)) return combined
  }

  return general || specificCategory || generalCategory
}

export function buildTerritorialDisplayName(fields: TerritorialNameFields): string {
  const specific = fields.specific_name?.trim() || ''

  if (specific && !isGenericTerritorialName(specific)) {
    return specific
  }

  const parent = resolveParentAreaLabel(fields)
  if (specific && parent) {
    return `${specific} — ${parent}`
  }

  if (specific) return specific
  if (parent) return parent

  const category = fields.specific_category?.trim() || fields.general_category?.trim()
  return category || 'Área protegida'
}

export function territorialNamesEqual(
  a: TerritorialNameFields & { general_code?: number; specific_code?: number },
  b: TerritorialNameFields & { general_code?: number; specific_code?: number },
): boolean {
  return (
    normalize(a.general_name) === normalize(b.general_name) &&
    normalize(a.specific_name) === normalize(b.specific_name) &&
    normalize(a.general_category) === normalize(b.general_category) &&
    normalize(a.specific_category) === normalize(b.specific_category) &&
    a.general_code === b.general_code &&
    a.specific_code === b.specific_code
  )
}
