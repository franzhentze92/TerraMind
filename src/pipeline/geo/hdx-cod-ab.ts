/** HDX COD-AB Guatemala — constantes y mapeo de códigos */

export const HDX_COD_AB_VERSION = '2025-10-30-v01'

export const HDX_COD_AB_SOURCE_DIR = `data/geo/sources/hdx-cod-ab-guatemala/${HDX_COD_AB_VERSION}`

export const HDX_COD_AB_FILES = {
  zip: 'gtm_admin_boundaries.geojson.zip',
  adm0: 'extracted/gtm_admin0.geojson',
  adm1: 'extracted/gtm_admin1.geojson',
} as const

export interface HdxAdm0Properties {
  iso2: string
  iso3: string
  adm0_name: string
  adm0_pcode: string
  valid_on: string
  version: string
  area_sqkm: number
}

export interface HdxAdm1Properties {
  adm1_name: string
  adm1_pcode: string
  adm0_pcode: string
  adm0_name: string
  valid_on: string
  version: string
  area_sqkm: number
}

/** GT16 → 16, GT01 → 01 */
export function pcodeToIneCode(adm1Pcode: string): string {
  const digits = adm1Pcode.replace(/^GT/i, '').padStart(2, '0')
  if (!/^\d{2}$/.test(digits)) {
    throw new Error(`P-code ADM1 inválido: ${adm1Pcode}`)
  }
  return digits
}

export const EXPECTED_ADM1_PCODES = [
  'GT01', 'GT02', 'GT03', 'GT04', 'GT05', 'GT06', 'GT07', 'GT08', 'GT09',
  'GT10', 'GT11', 'GT12', 'GT13', 'GT14', 'GT15', 'GT16', 'GT17', 'GT18',
  'GT19', 'GT20', 'GT21', 'GT22',
] as const
