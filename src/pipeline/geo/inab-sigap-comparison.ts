import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { open } from 'shapefile'
import proj4 from 'proj4'
import { readFileSync } from 'node:fs'
import {
  CONAP_SIGAP_SHAPEFILE_BASE,
  CONAP_SIGAP_SOURCE_DIR,
  normalizeTerritorialText,
} from '@/pipeline/geo/conap-sigap'

export interface InabComparisonResult {
  conap_count: number
  inab_count: number
  label_matches: number
  only_conap_labels: string[]
  only_inab_labels: string[]
  centroid_matches_100m: number
  report_path: string
}

function buildConapLabel(generalCategory: string, specificName: string): string {
  return normalizeTerritorialText(`${generalCategory} ${specificName}`.trim())
}

async function loadInabFeatures(): Promise<
  Array<{ label_key: string; centroid: [number, number] }>
> {
  const url =
    'https://sig.inab.gob.gt/server/rest/services/Hosted/SIGAP_12_2021/FeatureServer/1/query?where=1%3D1&outFields=concat_2,area_especifica&f=geojson&outSR=4326'

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`INAB fetch falló: ${response.status}`)
  }

  const data = (await response.json()) as {
    features: Array<{
      properties: { concat_2?: string; area_especifica?: string }
      geometry: GeoJSON.Geometry
    }>
  }

  return data.features.map((feature) => {
    const label = feature.properties.concat_2 || feature.properties.area_especifica || ''
    const centroid = geometryCentroid(feature.geometry)
    return { label_key: normalizeTerritorialText(label), centroid }
  })
}

function geometryCentroid(geometry: GeoJSON.Geometry): [number, number] {
  if (geometry.type === 'Point') {
    return [geometry.coordinates[0], geometry.coordinates[1]]
  }
  if (geometry.type === 'Polygon') {
    const ring = geometry.coordinates[0]
    const lng = ring.reduce((sum, c) => sum + c[0], 0) / ring.length
    const lat = ring.reduce((sum, c) => sum + c[1], 0) / ring.length
    return [lng, lat]
  }
  if (geometry.type === 'MultiPolygon') {
    return geometryCentroid({ type: 'Polygon', coordinates: geometry.coordinates[0] })
  }
  return [0, 0]
}

async function loadConapFeatures(): Promise<
  Array<{ label_key: string; centroid: [number, number] }>
> {
  const prj = readFileSync(`${CONAP_SIGAP_SHAPEFILE_BASE}.prj`, 'utf8')
  const transformer = (point: [number, number]): [number, number] =>
    proj4(prj, 'EPSG:4326', point) as [number, number]

  const source = await open(
    `${CONAP_SIGAP_SHAPEFILE_BASE}.shp`,
    `${CONAP_SIGAP_SHAPEFILE_BASE}.dbf`,
    { encoding: 'utf-8' },
  )

  const features: Array<{ label_key: string; centroid: [number, number] }> = []
  let result = await source.read()
  while (!result.done) {
    const props = result.value.properties as Record<string, unknown>
    const label = buildConapLabel(String(props.Categor_14 ?? props.Categor_13 ?? ''), String(props.NOMBRE_e_1 ?? props.NOMBRE_G_1 ?? ''))
    const geom = result.value.geometry as GeoJSON.Geometry
    const ring =
      geom.type === 'Polygon'
        ? geom.coordinates[0][0]
        : geom.type === 'MultiPolygon'
          ? geom.coordinates[0][0][0]
          : [0, 0]
    const centroid = transformer([ring[0], ring[1]])
    features.push({ label_key: label, centroid })
    result = await source.read()
  }
  return features
}

function matchCentroids(
  conap: Array<{ centroid: [number, number] }>,
  inab: Array<{ centroid: [number, number] }>,
  toleranceDeg: number,
): number {
  const used = new Set<number>()
  let matched = 0
  for (const c of conap) {
    for (let j = 0; j < inab.length; j += 1) {
      if (used.has(j)) continue
      const dx = c.centroid[0] - inab[j].centroid[0]
      const dy = c.centroid[1] - inab[j].centroid[1]
      if (dx * dx + dy * dy < toleranceDeg * toleranceDeg) {
        matched += 1
        used.add(j)
        break
      }
    }
  }
  return matched
}

export async function compareConapWithInab(): Promise<InabComparisonResult> {
  const [conap, inab] = await Promise.all([loadConapFeatures(), loadInabFeatures()])

  const conapLabels = new Set(conap.map((f) => f.label_key).filter(Boolean))
  const inabLabels = new Set(inab.map((f) => f.label_key).filter(Boolean))
  const both = [...conapLabels].filter((l) => inabLabels.has(l))
  const onlyConap = [...conapLabels].filter((l) => !inabLabels.has(l))
  const onlyInab = [...inabLabels].filter((l) => !conapLabels.has(l))

  const reportPath = resolve(CONAP_SIGAP_SOURCE_DIR, 'INAB-COMPARISON.md')
  const report = `# Comparación CONAP 2025 vs INAB 2022

| Métrica | Valor |
|---------|-------|
| CONAP registros | ${conap.length} |
| INAB registros | ${inab.length} |
| Etiquetas coincidentes (categoría + nombre) | ${both.length} |
| Solo CONAP | ${onlyConap.length} |
| Solo INAB | ${onlyInab.length} |
| Coincidencia centroides ~100 m | ${matchCentroids(conap, inab, 0.001)} |

## Explicación probable de la diferencia (${inab.length - conap.length} registros)

1. Actualización oficial CONAP diciembre 2025 vs publicación INAB mayo 2022.
2. Consolidación o eliminación de fragmentos poligonales.
3. Esquema de códigos distinto (numérico CONAP vs \`SIGAP-NN\` en INAB).
4. INAB puede incluir features adicionales de otra edición del SIGAP.

## Muestra solo CONAP

${onlyConap.slice(0, 15).map((l) => `- ${l}`).join('\n')}

## Muestra solo INAB

${onlyInab.slice(0, 15).map((l) => `- ${l}`).join('\n')}

> Fuente secundaria de control. No mezclar geometrías INAB en la capa operativa.
`

  writeFileSync(reportPath, report, 'utf8')

  return {
    conap_count: conap.length,
    inab_count: inab.length,
    label_matches: both.length,
    only_conap_labels: onlyConap,
    only_inab_labels: onlyInab,
    centroid_matches_100m: matchCentroids(conap, inab, 0.001),
    report_path: reportPath,
  }
}
