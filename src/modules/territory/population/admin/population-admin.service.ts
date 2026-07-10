/**
 * Servicio administrativo INE — diseño 7D.2.
 * Carga tablas oficiales departamento/municipio sin sustituir raster.
 */

import {
  INE_REFERENCE_YEAR,
  INE_SOURCE_CODE,
} from '../providers/ine/ine.manifest'
import type {
  AdministrativePopulationContext,
  AdministrativeUnitPopulation,
  GetAdministrativeContextInput,
} from '../population.types'

export interface PopulationAdminStore {
  getDepartment(code: string, referenceYear?: number): Promise<AdministrativeUnitPopulation | null>
  getMunicipality(
    code: string,
    referenceYear?: number,
  ): Promise<AdministrativeUnitPopulation | null>
}

export class PopulationAdminServiceNotReadyError extends Error {
  constructor(message = 'PopulationAdminService: datos INE no importados (7D.2).') {
    super(message)
    this.name = 'PopulationAdminServiceNotReadyError'
  }
}

export interface PopulationAdminService {
  getAdministrativeContext(
    input: GetAdministrativeContextInput,
  ): Promise<AdministrativePopulationContext>
}

export function createPopulationAdminService(
  _store?: PopulationAdminStore,
): PopulationAdminService {
  return {
    async getAdministrativeContext(input) {
      if (!input.departmentCode && !input.municipalityCode) {
        throw new PopulationAdminServiceNotReadyError('Código administrativo requerido.')
      }
      return {
        source: INE_SOURCE_CODE,
        referenceYear: input.referenceYear ?? INE_REFERENCE_YEAR,
        semantics: 'official_administrative_population',
      }
    },
  }
}

/**
 * Factor de reconciliación municipal (diseño — no aplicar hasta 7D.2+).
 */
export function computeMunicipalAdjustmentFactor(
  officialPopulation: number,
  rawRasterSum: number,
): number | null {
  if (rawRasterSum <= 0 || officialPopulation <= 0) return null
  return officialPopulation / rawRasterSum
}

export function applyMunicipalAdjustment(
  rawPixelPopulation: number,
  factor: number,
): number {
  return rawPixelPopulation * factor
}
