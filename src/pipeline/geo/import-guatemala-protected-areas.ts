import { readFileSync } from 'node:fs'
import { open } from 'shapefile'
import proj4 from 'proj4'
import {
  buildFeatureProperties,
  buildLogicalAreaKey,
  buildSourceFeatureId,
  hashNormalizedGeometry,
  CONAP_SIGAP_EXPECTED_FEATURES,
  CONAP_SIGAP_LAYER_CODE,
  CONAP_SIGAP_SHAPEFILE_BASE,
  CONAP_SIGAP_SOURCE_CRS,
  CONAP_SIGAP_SOURCE_DIR,
  CONAP_SIGAP_SOURCE_VERSION,
  type ConapSigapAttributes,
  pickFeatureName,
  pickFeatureType,
} from '@/pipeline/geo/conap-sigap'
import { compareConapWithInab } from '@/pipeline/geo/inab-sigap-comparison'
import {
  attributesEqual,
  writeDuplicateAuditReport,
  type ExactDuplicateRecord,
} from '@/pipeline/geo/sigap-duplicate-audit'
import { getTerritorialLayer, upsertTerritorialFeature } from '@/pipeline/stores/territorial.store'

const EXPECTED_REPAIRED_CODES = new Set([0, 11, 21, 33, 87])

export interface ProtectedAreasImportMetrics {
  source_records: number
  unique_features: number
  exact_duplicates_discarded: number
  real_errors: number
  repaired_geometry_codes: number
  null_names: number
  duration_ms: number
  errors: string[]
  duplicate_audit_path: string | null
}

interface SeenFeature {
  source_row: number
  source_feature_id: string
  logical_area_key: string
  geometry_hash: string
  attributes: ConapSigapAttributes
}

function stripZ(coords: number[]): [number, number] {
  return [coords[0], coords[1]]
}

function transformRing(
  ring: number[][],
  transformer: (point: [number, number]) => [number, number],
): number[][] {
  return ring.map((coord) => {
    const [x, y] = stripZ(coord)
    const [lng, lat] = transformer([x, y])
    return [lng, lat]
  })
}

function transformGeometryTo4326(
  geometry: GeoJSON.Geometry,
  transformer: (point: [number, number]) => [number, number],
): GeoJSON.Geometry {
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((ring) => transformRing(ring, transformer)),
    }
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) => transformRing(ring, transformer)),
      ),
    }
  }
  throw new Error(`Tipo de geometría no soportado: ${geometry.type}`)
}

function parseAttributes(properties: Record<string, unknown>): ConapSigapAttributes {
  return {
    codigo_g_1: Number(properties.codigo_g_1 ?? 0),
    codigo_e_2: Number(properties.codigo_e_2 ?? 0),
    NOMBRE_G_1: String(properties.NOMBRE_G_1 ?? ''),
    Categor_13: String(properties.Categor_13 ?? ''),
    NOMBRE_e_1: String(properties.NOMBRE_e_1 ?? ''),
    Categor_14: String(properties.Categor_14 ?? ''),
  }
}

export async function importGuatemalaProtectedAreas(): Promise<ProtectedAreasImportMetrics> {
  const started = Date.now()
  const metrics: ProtectedAreasImportMetrics = {
    source_records: 0,
    unique_features: 0,
    exact_duplicates_discarded: 0,
    real_errors: 0,
    repaired_geometry_codes: 0,
    null_names: 0,
    duration_ms: 0,
    errors: [],
    duplicate_audit_path: null,
  }

  const layer = await getTerritorialLayer(CONAP_SIGAP_LAYER_CODE)
  if (!layer) {
    throw new Error(`Capa ${CONAP_SIGAP_LAYER_CODE} no registrada en territorial_layers`)
  }

  const prj = readFileSync(`${CONAP_SIGAP_SHAPEFILE_BASE}.prj`, 'utf8')
  const transformer = (point: [number, number]): [number, number] =>
    proj4(prj, 'EPSG:4326', point) as [number, number]

  const source = await open(
    `${CONAP_SIGAP_SHAPEFILE_BASE}.shp`,
    `${CONAP_SIGAP_SHAPEFILE_BASE}.dbf`,
    { encoding: 'utf-8' },
  )

  const seenById = new Map<string, SeenFeature>()
  const duplicateRecords: ExactDuplicateRecord[] = []
  const repairedCodesSeen = new Set<number>()
  let result = await source.read()

  while (!result.done) {
    metrics.source_records += 1
    const rowNumber = metrics.source_records
    const feature = result.value

    try {
      const attrs = parseAttributes(feature.properties as Record<string, unknown>)
      const name = pickFeatureName(attrs)
      if (!name || name === 'Sin nombre') metrics.null_names += 1

      const geometry4326 = transformGeometryTo4326(
        feature.geometry as GeoJSON.Geometry,
        transformer,
      )
      const logicalAreaKey = buildLogicalAreaKey(attrs)
      const geometryHash = hashNormalizedGeometry(geometry4326)
      const sourceFeatureId = buildSourceFeatureId(logicalAreaKey, geometry4326)

      const prior = seenById.get(sourceFeatureId)
      if (prior) {
        const matches = attributesEqual(prior.attributes, attrs)
        if (!matches) {
          metrics.real_errors += 1
          metrics.errors.push(
            `Fila ${rowNumber}: duplicado geométrico con diferencia material respecto a fila ${prior.source_row}`,
          )
          result = await source.read()
          continue
        }

        metrics.exact_duplicates_discarded += 1
        duplicateRecords.push({
          source_row: rowNumber,
          source_feature_id: sourceFeatureId,
          logical_area_key: logicalAreaKey,
          geometry_hash: geometryHash,
          attributes: attrs,
          matches_prior_row: true,
          material_difference: null,
        })
        result = await source.read()
        continue
      }

      seenById.set(sourceFeatureId, {
        source_row: rowNumber,
        source_feature_id: sourceFeatureId,
        logical_area_key: logicalAreaKey,
        geometry_hash: geometryHash,
        attributes: attrs,
      })

      await upsertTerritorialFeature({
        layerCode: CONAP_SIGAP_LAYER_CODE,
        sourceFeatureId,
        logicalAreaKey,
        name,
        featureType: pickFeatureType(attrs),
        properties: buildFeatureProperties(attrs),
        geometry: geometry4326,
      })

      metrics.unique_features += 1
      if (EXPECTED_REPAIRED_CODES.has(attrs.codigo_g_1)) {
        repairedCodesSeen.add(attrs.codigo_g_1)
      }
    } catch (err) {
      metrics.real_errors += 1
      const message = err instanceof Error ? err.message : String(err)
      metrics.errors.push(`Fila ${rowNumber}: ${message}`)
    }

    result = await source.read()
  }

  metrics.repaired_geometry_codes = repairedCodesSeen.size
  metrics.duration_ms = Date.now() - started

  metrics.duplicate_audit_path = writeDuplicateAuditReport({
    source_records: metrics.source_records,
    unique_features: metrics.unique_features,
    exact_duplicates_discarded: metrics.exact_duplicates_discarded,
    real_errors: metrics.real_errors,
    duplicates: duplicateRecords,
  })

  if (metrics.source_records !== CONAP_SIGAP_EXPECTED_FEATURES) {
    metrics.errors.push(
      `Conteo fuente ${metrics.source_records} ≠ esperado ${CONAP_SIGAP_EXPECTED_FEATURES}`,
    )
  }

  console.log('\n📋 Comparación CONAP vs INAB (control secundario)')
  const comparison = await compareConapWithInab()
  console.log(`   CONAP: ${comparison.conap_count} | INAB: ${comparison.inab_count}`)
  console.log(`   Etiquetas coincidentes: ${comparison.label_matches}`)
  console.log(`   Reporte: ${comparison.report_path}`)

  console.log('\n✅ Importación áreas protegidas SIGAP')
  console.log(`   Fuente: ${CONAP_SIGAP_SOURCE_DIR}`)
  console.log(`   Versión: ${CONAP_SIGAP_SOURCE_VERSION} (${CONAP_SIGAP_SOURCE_CRS})`)
  console.log(`   Registros fuente: ${metrics.source_records}`)
  console.log(`   Features geográficas únicas: ${metrics.unique_features}`)
  console.log(`   Duplicados exactos descartados: ${metrics.exact_duplicates_discarded}`)
  console.log(`   Errores reales: ${metrics.real_errors}`)
  console.log(`   Geometrías reparadas (códigos 0/11/21/33/87): ${metrics.repaired_geometry_codes}`)
  console.log(`   Auditoría duplicados: ${metrics.duplicate_audit_path}`)
  console.log(`   Duración: ${metrics.duration_ms}ms`)

  if (metrics.errors.length > 0) {
    console.log('\n⚠️  Advertencias:')
    for (const e of metrics.errors.slice(0, 10)) console.log(`   - ${e}`)
  }

  return metrics
}
