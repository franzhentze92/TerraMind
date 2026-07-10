import { buildTerritorialDisplayName } from '@/modules/fires/utils/territorial-display'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

export const CONAP_SIGAP_LAYER_CODE = 'gt_protected_areas' as const

export const CONAP_SIGAP_SOURCE_DIR = resolve(
  process.cwd(),
  'data/geo/sources/conap-sigap-guatemala/2025-12-08-v01',
)

export const CONAP_SIGAP_SHAPEFILE_BASE = resolve(
  CONAP_SIGAP_SOURCE_DIR,
  'SIGAP_08122025_IP',
)

export const CONAP_SIGAP_SOURCE_VERSION = 'SIGAP_08122025_IP'
export const CONAP_SIGAP_SOURCE_DATE = '2025-12-08'
export const CONAP_SIGAP_EXPECTED_FEATURES = 406
export const CONAP_SIGAP_SOURCE_CRS = 'ESRI:103598'

export interface ConapSigapAttributes {
  codigo_g_1: number
  codigo_e_2: number
  NOMBRE_G_1: string
  Categor_13: string
  NOMBRE_e_1: string
  Categor_14: string
}

export function normalizeTerritorialText(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
}

export function buildLogicalAreaKey(attrs: ConapSigapAttributes): string {
  return [
    String(attrs.codigo_g_1),
    String(attrs.codigo_e_2),
    normalizeTerritorialText(attrs.NOMBRE_G_1),
    normalizeTerritorialText(attrs.NOMBRE_e_1),
  ].join('|')
}

export function hashNormalizedGeometry(geometryGeoJson: GeoJSON.Geometry): string {
  const normalized = JSON.stringify(geometryGeoJson)
  return createHash('sha256').update(normalized).digest('hex')
}

export function buildSourceFeatureId(
  logicalAreaKey: string,
  geometryGeoJson: GeoJSON.Geometry,
): string {
  return createHash('sha256')
    .update(`${logicalAreaKey}|${hashNormalizedGeometry(geometryGeoJson)}`)
    .digest('hex')
}

export function pickFeatureName(attrs: ConapSigapAttributes): string {
  return buildTerritorialDisplayName({
    general_name: attrs.NOMBRE_G_1,
    specific_name: attrs.NOMBRE_e_1,
    general_category: attrs.Categor_13,
    specific_category: attrs.Categor_14,
  })
}

export function pickFeatureType(attrs: ConapSigapAttributes): string | null {
  const specific = attrs.Categor_14?.trim()
  if (specific) return specific
  const general = attrs.Categor_13?.trim()
  return general || null
}

export function buildFeatureProperties(attrs: ConapSigapAttributes): Record<string, unknown> {
  const display_name = pickFeatureName(attrs)
  return {
    general_code: attrs.codigo_g_1,
    specific_code: attrs.codigo_e_2,
    general_name: attrs.NOMBRE_G_1,
    specific_name: attrs.NOMBRE_e_1,
    general_category: attrs.Categor_13,
    specific_category: attrs.Categor_14,
    display_name,
    source_dataset: CONAP_SIGAP_SOURCE_VERSION,
    source_crs: CONAP_SIGAP_SOURCE_CRS,
  }
}

export function buildContextVersion(layerVersion: string, featureCount: number, artifactHash: string): string {
  return createHash('sha256')
    .update(`${layerVersion}|${featureCount}|${artifactHash}`)
    .digest('hex')
    .slice(0, 16)
}
