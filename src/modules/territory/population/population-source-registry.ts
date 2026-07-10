import {
  GHSL_ATTRIBUTION,
  GHSL_DATASET_NAME,
  GHSL_LICENSE,
  GHSL_REFERENCE_YEAR,
  GHSL_SOURCE_CODE,
  GHSL_SOURCE_VERSION,
  GHSL_SPATIAL_RESOLUTION_M,
} from './providers/ghsl/ghsl.manifest'
import {
  INE_ATTRIBUTION,
  INE_DATASET_NAME,
  INE_LICENSE,
  INE_REFERENCE_YEAR,
  INE_SOURCE_CODE,
  INE_SOURCE_VERSION,
} from './providers/ine/ine.manifest'
import {
  WORLDPOP_ATTRIBUTION,
  WORLDPOP_DATASET_NAME,
  WORLDPOP_LICENSE,
  WORLDPOP_PRIMARY_FILE,
  WORLDPOP_REFERENCE_YEAR,
  WORLDPOP_SOURCE_CODE,
  WORLDPOP_SOURCE_VERSION,
  WORLDPOP_SPATIAL_RESOLUTION_M,
} from './providers/worldpop/worldpop.manifest'
import type { PopulationSemantics } from './population.types'

export type PopulationSourceRole =
  | 'official_administrative'
  | 'modelled_spatial_primary'
  | 'modelled_spatial_validation'

export interface PopulationSourceDefinition {
  sourceCode: string
  name: string
  organization: string
  datasetName: string
  sourceVersion: string
  referenceYear: number
  license: string
  attribution: string
  spatialResolutionM?: number
  semantics: PopulationSemantics
  role: PopulationSourceRole
  isOfficial: boolean
  isActive: boolean
  primaryArtifact?: string
  methodology: string
}

export const POPULATION_SOURCE_REGISTRY: readonly PopulationSourceDefinition[] = [
  {
    sourceCode: INE_SOURCE_CODE,
    name: 'INE Guatemala — Censo 2018',
    organization: 'Instituto Nacional de Estadística',
    datasetName: INE_DATASET_NAME,
    sourceVersion: INE_SOURCE_VERSION,
    referenceYear: INE_REFERENCE_YEAR,
    license: INE_LICENSE,
    attribution: INE_ATTRIBUTION,
    semantics: 'official_administrative_population',
    role: 'official_administrative',
    isOfficial: true,
    isActive: true,
    methodology: 'Censo nacional de población y vivienda 2018',
  },
  {
    sourceCode: WORLDPOP_SOURCE_CODE,
    name: 'WorldPop Guatemala constrained 100m',
    organization: 'WorldPop — University of Southampton',
    datasetName: WORLDPOP_DATASET_NAME,
    sourceVersion: WORLDPOP_SOURCE_VERSION,
    referenceYear: WORLDPOP_REFERENCE_YEAR,
    license: WORLDPOP_LICENSE,
    attribution: WORLDPOP_ATTRIBUTION,
    spatialResolutionM: WORLDPOP_SPATIAL_RESOLUTION_M,
    semantics: 'modelled_spatial_population',
    role: 'modelled_spatial_primary',
    isOfficial: false,
    isActive: true,
    primaryArtifact: WORLDPOP_PRIMARY_FILE,
    methodology: 'Random Forest dasymetric constrained redistribution',
  },
  {
    sourceCode: GHSL_SOURCE_CODE,
    name: 'GHSL GHS-POP R2023A',
    organization: 'European Commission — JRC',
    datasetName: GHSL_DATASET_NAME,
    sourceVersion: GHSL_SOURCE_VERSION,
    referenceYear: GHSL_REFERENCE_YEAR,
    license: GHSL_LICENSE,
    attribution: GHSL_ATTRIBUTION,
    spatialResolutionM: GHSL_SPATIAL_RESOLUTION_M,
    semantics: 'modelled_spatial_population',
    role: 'modelled_spatial_validation',
    isOfficial: false,
    isActive: false,
    methodology: 'GPWv4.11 disaggregation informed by GHSL built-up volume',
  },
] as const

export function getPopulationSource(sourceCode: string): PopulationSourceDefinition | undefined {
  return POPULATION_SOURCE_REGISTRY.find((s) => s.sourceCode === sourceCode)
}

export function getPrimarySpatialSource(): PopulationSourceDefinition {
  const source = POPULATION_SOURCE_REGISTRY.find((s) => s.role === 'modelled_spatial_primary')
  if (!source) throw new Error('Population source registry: missing primary spatial source')
  return source
}

export function getOfficialAdministrativeSource(): PopulationSourceDefinition {
  const source = POPULATION_SOURCE_REGISTRY.find((s) => s.role === 'official_administrative')
  if (!source) throw new Error('Population source registry: missing official administrative source')
  return source
}

export const RECOMMENDED_SPATIAL_SOURCE_CODE = WORLDPOP_SOURCE_CODE
