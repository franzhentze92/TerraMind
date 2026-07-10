/**
 * Referencia INE proyección 2020 — para comparación año-compatible con WorldPop 2020.
 * Fuente: INE Guatemala, Estimaciones y proyecciones departamentales 2010-2050 (actualización 2020).
 * @see https://www.ine.gob.gt/proyecciones/
 *
 * NO usar Censo 2018 para reconciliación directa con raster 2020.
 */

export const INE_PROJECTION_REFERENCE_YEAR = 2020 as const
export const INE_PROJECTION_SOURCE =
  'INE Guatemala — Proyecciones departamentales 2010-2050 (actualización agosto 2020)' as const

/** Población nacional proyectada INE 2020. */
export const INE_NATIONAL_PROJECTION_2020 = 17_980_803 as const

/** Censo 2018 — solo sección separada, no para Δ raster 2020. */
export const INE_CENSUS_NATIONAL_2018 = 14_901_286 as const

export interface IneDepartmentProjection2020 {
  adm1Pcode: string
  departmentName: string
  population2020: number
}

/**
 * Totales departamentales INE proyección 2020 (22 departamentos).
 * Valores de hoja electrónica INE «Resultados Departamentales».
 */
export const INE_DEPARTMENT_PROJECTIONS_2020: readonly IneDepartmentProjection2020[] = [
  { adm1Pcode: 'GT01', departmentName: 'Guatemala', population2020: 3_318_117 },
  { adm1Pcode: 'GT02', departmentName: 'El Progreso', population2020: 188_707 },
  { adm1Pcode: 'GT03', departmentName: 'Sacatepéquez', population2020: 351_217 },
  { adm1Pcode: 'GT04', departmentName: 'Chimaltenango', population2020: 615_776 },
  { adm1Pcode: 'GT05', departmentName: 'Escuintla', population2020: 811_166 },
  { adm1Pcode: 'GT06', departmentName: 'Santa Rosa', population2020: 389_797 },
  { adm1Pcode: 'GT07', departmentName: 'Sololá', population2020: 447_588 },
  { adm1Pcode: 'GT08', departmentName: 'Totonicapán', population2020: 453_237 },
  { adm1Pcode: 'GT09', departmentName: 'Quetzaltenango', population2020: 799_101 },
  { adm1Pcode: 'GT10', departmentName: 'Suchitepéquez', population2020: 521_307 },
  { adm1Pcode: 'GT11', departmentName: 'Retalhuleu', population2020: 331_743 },
  { adm1Pcode: 'GT12', departmentName: 'San Marcos', population2020: 1_057_090 },
  { adm1Pcode: 'GT13', departmentName: 'Huehuetenango', population2020: 1_209_607 },
  { adm1Pcode: 'GT14', departmentName: 'Quiché', population2020: 1_011_881 },
  { adm1Pcode: 'GT15', departmentName: 'Baja Verapaz', population2020: 299_516 },
  { adm1Pcode: 'GT16', departmentName: 'Alta Verapaz', population2020: 1_145_592 },
  { adm1Pcode: 'GT17', departmentName: 'Petén', population2020: 614_397 },
  { adm1Pcode: 'GT18', departmentName: 'Izabal', population2020: 513_607 },
  { adm1Pcode: 'GT19', departmentName: 'Zacapa', population2020: 262_134 },
  { adm1Pcode: 'GT20', departmentName: 'Chiquimula', population2020: 438_485 },
  { adm1Pcode: 'GT21', departmentName: 'Jalapa', population2020: 391_109 },
  { adm1Pcode: 'GT22', departmentName: 'Jutiapa', population2020: 573_063 },
] as const

export function getIneDepartmentProjection2020(
  adm1Pcode: string,
): IneDepartmentProjection2020 | undefined {
  return INE_DEPARTMENT_PROJECTIONS_2020.find((d) => d.adm1Pcode === adm1Pcode)
}
