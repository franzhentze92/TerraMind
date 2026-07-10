/**
 * XII Censo Nacional de Población 2018 — totales departamentales.
 * Fuente: INE Guatemala, censo2018.ine.gob.gt (Cuadro 3 / resultados oficiales).
 * @see https://censo2018.ine.gob.gt/
 */

export const INE_CENSUS_SOURCE =
  'INE Guatemala — XII Censo Nacional de Población y VII de Vivienda 2018' as const

export interface IneDepartmentCensus2018 {
  adm1Pcode: string
  departmentName: string
  population2018: number
}

/** 22 departamentos — suma nacional = 14,901,286 */
export const INE_DEPARTMENT_CENSUS_2018: readonly IneDepartmentCensus2018[] = [
  { adm1Pcode: 'GT01', departmentName: 'Guatemala', population2018: 3_015_081 },
  { adm1Pcode: 'GT02', departmentName: 'El Progreso', population2018: 176_632 },
  { adm1Pcode: 'GT03', departmentName: 'Sacatepéquez', population2018: 330_469 },
  { adm1Pcode: 'GT04', departmentName: 'Chimaltenango', population2018: 615_776 },
  { adm1Pcode: 'GT05', departmentName: 'Escuintla', population2018: 733_181 },
  { adm1Pcode: 'GT06', departmentName: 'Santa Rosa', population2018: 396_607 },
  { adm1Pcode: 'GT07', departmentName: 'Sololá', population2018: 421_583 },
  { adm1Pcode: 'GT08', departmentName: 'Totonicapán', population2018: 418_569 },
  { adm1Pcode: 'GT09', departmentName: 'Quetzaltenango', population2018: 799_101 },
  { adm1Pcode: 'GT10', departmentName: 'Suchitepéquez', population2018: 554_695 },
  { adm1Pcode: 'GT11', departmentName: 'Retalhuleu', population2018: 326_828 },
  { adm1Pcode: 'GT12', departmentName: 'San Marcos', population2018: 1_032_277 },
  { adm1Pcode: 'GT13', departmentName: 'Huehuetenango', population2018: 1_170_669 },
  { adm1Pcode: 'GT14', departmentName: 'Quiché', population2018: 949_261 },
  { adm1Pcode: 'GT15', departmentName: 'Baja Verapaz', population2018: 299_476 },
  { adm1Pcode: 'GT16', departmentName: 'Alta Verapaz', population2018: 1_215_038 },
  { adm1Pcode: 'GT17', departmentName: 'Petén', population2018: 626_307 },
  { adm1Pcode: 'GT18', departmentName: 'Izabal', population2018: 408_688 },
  { adm1Pcode: 'GT19', departmentName: 'Zacapa', population2018: 245_374 },
  { adm1Pcode: 'GT20', departmentName: 'Chiquimula', population2018: 415_063 },
  { adm1Pcode: 'GT21', departmentName: 'Jalapa', population2018: 342_923 },
  { adm1Pcode: 'GT22', departmentName: 'Jutiapa', population2018: 407_688 },
] as const

export function getIneDepartmentCensus2018(adm1Pcode: string): IneDepartmentCensus2018 | undefined {
  return INE_DEPARTMENT_CENSUS_2018.find((d) => d.adm1Pcode === adm1Pcode)
}
