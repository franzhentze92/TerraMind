/**
 * Inventario documentado de fuentes INE / complementarias (7D.2).
 */

export interface IneSourceDataset {
  id: string
  name: string
  organization: string
  url: string
  publishedAt: string
  referenceYear: number
  coverage: string
  adminLevel: string
  format: string
  license: string
  territorialCodes: string
  methodology: string
  limitations: string
  statisticKind: 'census' | 'projection' | 'complement'
}

export const INE_SOURCE_INVENTORY: readonly IneSourceDataset[] = [
  {
    id: 'ine_census_2018',
    name: 'XII Censo Nacional de Población y VII de Vivienda 2018',
    organization: 'INE Guatemala',
    url: 'https://censo2018.ine.gob.gt/',
    publishedAt: '2019-09-17',
    referenceYear: 2018,
    coverage: 'Nacional, 22 departamentos, 340 municipios',
    adminLevel: 'department,municipality',
    format: 'Portal web, PDF, tabulados',
    license: 'public-institutional',
    territorialCodes: 'Código departamento/municipio INE',
    methodology: 'Censo de hecho julio-agosto 2018',
    limitations: 'No usar como año 2020; no microdatos en TerraMind',
    statisticKind: 'census',
  },
  {
    id: 'ine_projection_2020',
    name: 'Proyecciones departamentales 2010-2050 (actualización agosto 2020)',
    organization: 'INE Guatemala',
    url: 'https://www.ine.gob.gt/proyecciones/',
    publishedAt: '2020-08',
    referenceYear: 2020,
    coverage: 'Nacional y 22 departamentos',
    adminLevel: 'department',
    format: 'Hoja electrónica / publicación',
    license: 'public-institutional',
    territorialCodes: 'GT01-GT22 (armonizado HDX COD-AB)',
    methodology: 'Proyección demográfica oficial',
    limitations: 'Proyección municipal 2020 no importada en 7D.2 inicial',
    statisticKind: 'projection',
  },
  {
    id: 'hdx_cod_ab_municipal_seats',
    name: 'HDX COD-AB Guatemala admin points (complemento asentamientos)',
    organization: 'OCHA / HDX',
    url: 'https://data.humdata.org/dataset/cod-ab-gtm',
    publishedAt: '2025-10-30',
    referenceYear: 2019,
    coverage: 'Cabeceras municipales y niveles admin',
    adminLevel: 'municipality',
    format: 'GeoJSON',
    license: 'CC BY IGAD',
    territorialCodes: 'adm2_pcode GTDDMM',
    methodology: 'Puntos administrativos COD-AB',
    limitations: 'No sustituye INE lugares poblados 2018; sin población por asentamiento',
    statisticKind: 'complement',
  },
] as const
