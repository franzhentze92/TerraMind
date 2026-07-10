/**
 * PoC 7D.1 — metadata y zonas de prueba sin descarga raster.
 * Ejecutar: npx tsx scripts/population-source-poc.ts
 */

import {
  getOfficialAdministrativeSource,
  getPrimarySpatialSource,
  POPULATION_SOURCE_REGISTRY,
  RECOMMENDED_SPATIAL_SOURCE_CODE,
} from '../src/modules/territory/population/population-source-registry'
import { INE_NATIONAL_POPULATION_2018, INE_REFERENCE_TOTALS } from '../src/modules/territory/population/providers/ine/ine.manifest'
import { WORLDPOP_PRIMARY_FILE, WORLDPOP_PRIMARY_FILE_SIZE_BYTES } from '../src/modules/territory/population/providers/worldpop/worldpop.manifest'

const GUATEMALA_BOUNDS = {
  minLat: 13.7,
  maxLat: 17.8,
  minLon: -92.3,
  maxLon: -88.2,
}

const POC_ZONES = [
  { name: 'Ciudad de Guatemala', lat: 14.6349, lon: -90.5069 },
  { name: 'Champerico', lat: 14.2883, lon: -91.9081 },
  { name: 'Reserva Biosfera Maya', lat: 17.75, lon: -89.5 },
  { name: 'Corredor Seco', lat: 14.75, lon: -89.35 },
  { name: 'Lago de Atitlán', lat: 14.6833, lon: -91.2 },
] as const

function insideGuatemala(lat: number, lon: number): boolean {
  return (
    lat >= GUATEMALA_BOUNDS.minLat &&
    lat <= GUATEMALA_BOUNDS.maxLat &&
    lon >= GUATEMALA_BOUNDS.minLon &&
    lon <= GUATEMALA_BOUNDS.maxLon
  )
}

function main() {
  const spatial = getPrimarySpatialSource()
  const official = getOfficialAdministrativeSource()

  const report = {
    phase: '7D.1-design-poc',
    recommendedSpatialSource: RECOMMENDED_SPATIAL_SOURCE_CODE,
    sources: POPULATION_SOURCE_REGISTRY.map((s) => ({
      code: s.sourceCode,
      role: s.role,
      year: s.referenceYear,
      resolutionM: s.spatialResolutionM,
      license: s.license,
      isOfficial: s.isOfficial,
      isActive: s.isActive,
    })),
    primaryRaster: {
      file: WORLDPOP_PRIMARY_FILE,
      sizeBytes: WORLDPOP_PRIMARY_FILE_SIZE_BYTES,
      source: spatial.sourceCode,
      version: spatial.sourceVersion,
    },
    ineReference: {
      national2018: INE_NATIONAL_POPULATION_2018,
      samples: INE_REFERENCE_TOTALS,
      officialSource: official.sourceCode,
    },
    zones: POC_ZONES.map((z) => ({
      ...z,
      insideGuatemala: insideGuatemala(z.lat, z.lon),
      rasterStatus: 'not_downloaded',
      administrativeStatus: 'ine_tables_not_imported',
      estimatedPopulation: null,
      queryTimeMs: null,
      limitations: [
        'Sin raster montado — estimación espacial pendiente 7D.1A',
        'Sin tablas INE en Supabase — contexto oficial pendiente 7D.2',
      ],
    })),
    disclaimer:
      'Estimación espacial de población residente. La proximidad a una situación ambiental no implica afectación confirmada ni presencia en tiempo real.',
  }

  console.log(JSON.stringify(report, null, 2))
}

main()
