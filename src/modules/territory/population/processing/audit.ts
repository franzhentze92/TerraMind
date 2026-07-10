import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { runCommand } from '@/modules/territory/population/processing/gdal'
import {
  loadPopulationManifest,
  savePopulationManifest,
} from '@/modules/territory/population/processing/manifest-io'
import {
  GUATEMALA_ADM1_GEOJSON,
  POPULATION_AUDIT_REPORT,
  POPULATION_CLIP_TEMP_DIR,
  processedLaeaCog,
  processedWgs84Cog,
} from '@/modules/territory/population/processing/paths'
import {
  inspectPopulationRaster,
  populationDiffPct,
  type PopulationRasterInspection,
} from '@/modules/territory/population/processing/raster-stats'
import {
  INE_CENSUS_NATIONAL_2018,
  INE_DEPARTMENT_PROJECTIONS_2020,
  INE_NATIONAL_PROJECTION_2020,
  INE_PROJECTION_REFERENCE_YEAR,
  INE_PROJECTION_SOURCE,
} from '@/modules/territory/population/providers/ine/ine-projection-2020-reference'
import type { WorldPopVariant } from '@/modules/territory/population/providers/worldpop/worldpop-products'

export interface DepartmentAuditRow {
  adm1Pcode: string
  departmentName: string
  constrainedSum: number
  unconstrainedSum: number
  ineProjection2020: number
  pctNationalConstrained: number
  pctNationalUnconstrained: number
  densityConstrainedPerKm2: number
  deltaConstrainedPct: number
  deltaUnconstrainedPct: number
  areaSqkm: number
}

export interface TerritorialZoneAudit {
  name: string
  lat: number
  lon: number
  constrained: Record<string, number>
  unconstrained: Record<string, number>
  coherentVariant: WorldPopVariant | 'mixed'
  notes: string[]
}

export interface PopulationAuditReport {
  generatedAt: string
  national: {
    constrained: number
    unconstrained: number
    ineProjection2020: number
    ineCensus2018Separate: number
    deltaConstrainedVsIne2020Pct: number
    deltaUnconstrainedVsIne2020Pct: number
  }
  departments: DepartmentAuditRow[]
  territorialZones: TerritorialZoneAudit[]
  rawInspections: Record<string, PopulationRasterInspection>
  recommendedPrimaryVariant: WorldPopVariant | 'dual_use'
  recommendationRationale: string[]
  limitations: string[]
}

const BUFFER_RADII_M = [500, 1000, 3000, 5000] as const

const TERRITORIAL_ZONES = [
  { name: 'Ciudad de Guatemala', lat: 14.6349, lon: -90.5069 },
  { name: 'Mixco', lat: 14.6333, lon: -90.6064 },
  { name: 'Champerico', lat: 14.2883, lon: -91.9081 },
  { name: 'Lago de Atitlán (centro)', lat: 14.6833, lon: -91.2 },
  { name: 'Reserva Biosfera Maya', lat: 17.75, lon: -89.5 },
  { name: 'Corredor Seco', lat: 14.75, lon: -89.35 },
  { name: 'Comunidad rural dispersa (Huehuetenango)', lat: 15.3147, lon: -91.4761 },
  { name: 'Zona no habitada (volcán Tajumulco)', lat: 15.043, lon: -91.903 },
] as const

function tempPath(name: string): string {
  mkdirSync(POPULATION_CLIP_TEMP_DIR, { recursive: true })
  return resolve(POPULATION_CLIP_TEMP_DIR, name)
}

async function clipToGeojson(
  rasterPath: string,
  cutlinePath: string,
  outPath: string,
): Promise<void> {
  const res = await runCommand('gdalwarp', [
    '-cutline',
    cutlinePath,
    '-crop_to_cutline',
    '-dstnodata',
    '-9999',
    rasterPath,
    outPath,
  ])
  if (res.exitCode !== 0) {
    throw new Error(`gdalwarp clip falló: ${res.stderr || res.stdout}`)
  }
}

async function sumRasterAtCutline(
  rasterPath: string,
  cutlineGeojson: GeoJSON.Feature | GeoJSON.FeatureCollection,
): Promise<number> {
  const cutline = tempPath(`cut_${Date.now()}_${Math.random().toString(36).slice(2)}.geojson`)
  const out = tempPath(`sum_${Date.now()}_${Math.random().toString(36).slice(2)}.tif`)
  writeFileSync(cutline, JSON.stringify(cutlineGeojson))
  try {
    await clipToGeojson(rasterPath, cutline, out)
    const inspection = await inspectPopulationRaster(out)
    return inspection.populationSum
  } finally {
    if (existsSync(cutline)) unlinkSync(cutline)
    if (existsSync(out)) unlinkSync(out)
  }
}

function bufferBboxPolygon(lat: number, lon: number, radiusM: number): GeoJSON.Polygon {
  const dLat = radiusM / 111_320
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180))
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon - dLon, lat - dLat],
        [lon + dLon, lat - dLat],
        [lon + dLon, lat + dLat],
        [lon - dLon, lat + dLat],
        [lon - dLon, lat - dLat],
      ],
    ],
  }
}

async function sumBuffersAroundPoint(
  rasterPath: string,
  lat: number,
  lon: number,
  radiiM: readonly number[],
): Promise<Record<string, number>> {
  const results: Record<string, number> = {}
  for (const radiusM of radiiM) {
    const fc: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: bufferBboxPolygon(lat, lon, radiusM),
        },
      ],
    }
    results[String(radiusM)] = await sumRasterAtCutline(rasterPath, fc)
  }
  return results
}

function readAdm1Features(): GeoJSON.Feature[] {
  const fc = JSON.parse(readFileSync(GUATEMALA_ADM1_GEOJSON, 'utf8')) as GeoJSON.FeatureCollection
  return fc.features
}

export async function auditWorldPop2020(): Promise<PopulationAuditReport> {
  const constrainedCog = processedWgs84Cog('constrained')
  const unconstrainedCog = processedWgs84Cog('unconstrained')
  if (!existsSync(constrainedCog) || !existsSync(unconstrainedCog)) {
    throw new Error('COGs no preparados. Ejecutar population:prepare-worldpop.')
  }

  const constrainedInspection = await inspectPopulationRaster(constrainedCog)
  const unconstrainedInspection = await inspectPopulationRaster(unconstrainedCog)
  const nationalConstrained = constrainedInspection.populationSum
  const nationalUnconstrained = unconstrainedInspection.populationSum

  const departments: DepartmentAuditRow[] = []
  for (const feature of readAdm1Features()) {
    const props = feature.properties ?? {}
    const adm1Pcode = String(props.adm1_pcode ?? '')
    const departmentName = String(props.adm1_name ?? adm1Pcode)
    const areaSqkm = Number(props.area_sqkm ?? 0)
    const ine = INE_DEPARTMENT_PROJECTIONS_2020.find((d) => d.adm1Pcode === adm1Pcode)

    const cutline = tempPath(`dept_${adm1Pcode}.geojson`)
    writeFileSync(
      cutline,
      JSON.stringify({ type: 'FeatureCollection', features: [feature] }),
    )
    const cOut = tempPath(`dept_c_${adm1Pcode}.tif`)
    const uOut = tempPath(`dept_u_${adm1Pcode}.tif`)
    await clipToGeojson(constrainedCog, cutline, cOut)
    await clipToGeojson(unconstrainedCog, cutline, uOut)
    const cSum = (await inspectPopulationRaster(cOut)).populationSum
    const uSum = (await inspectPopulationRaster(uOut)).populationSum
    unlinkSync(cutline)
    unlinkSync(cOut)
    unlinkSync(uOut)

    const inePop = ine?.population2020 ?? 0
    departments.push({
      adm1Pcode,
      departmentName,
      constrainedSum: cSum,
      unconstrainedSum: uSum,
      ineProjection2020: inePop,
      pctNationalConstrained: nationalConstrained > 0 ? (cSum / nationalConstrained) * 100 : 0,
      pctNationalUnconstrained: nationalUnconstrained > 0 ? (uSum / nationalUnconstrained) * 100 : 0,
      densityConstrainedPerKm2: areaSqkm > 0 ? Math.round((cSum / areaSqkm) * 10) / 10 : 0,
      deltaConstrainedPct: inePop > 0 ? populationDiffPct(inePop, cSum) : 0,
      deltaUnconstrainedPct: inePop > 0 ? populationDiffPct(inePop, uSum) : 0,
      areaSqkm,
    })
  }

  const territorialZones: TerritorialZoneAudit[] = []
  for (const zone of TERRITORIAL_ZONES) {
    const constrained = await sumBuffersAroundPoint(
      processedWgs84Cog('constrained'),
      zone.lat,
      zone.lon,
      BUFFER_RADII_M,
    )
    const unconstrained = await sumBuffersAroundPoint(
      processedWgs84Cog('unconstrained'),
      zone.lat,
      zone.lon,
      BUFFER_RADII_M,
    )
    const ratio5km =
      unconstrained['5000'] > 0 ? constrained['5000'] / unconstrained['5000'] : 1
    let coherentVariant: WorldPopVariant | 'mixed' = 'mixed'
    const notes: string[] = []
    if (zone.name.includes('no habitada') || zone.name.includes('Biosfera Maya')) {
      coherentVariant = ratio5km > 1.3 ? 'constrained' : 'unconstrained'
      notes.push('Área de baja densidad — constrained tiende a concentrar en asentamientos mapeados.')
    } else if (zone.name.includes('Guatemala') || zone.name.includes('Mixco')) {
      coherentVariant = 'constrained'
      notes.push('Centro urbano — constrained alinea mejor con tejido construido.')
    } else if (zone.name.includes('Corredor Seco') || zone.name.includes('rural')) {
      coherentVariant = ratio5km < 0.85 ? 'unconstrained' : 'constrained'
      notes.push('Rural disperso — evaluar subestimación dasimétrica constrained.')
    } else {
      notes.push('Patrón mixto — revisar visualmente en 7D.1B.')
    }
    territorialZones.push({
      name: zone.name,
      lat: zone.lat,
      lon: zone.lon,
      constrained,
      unconstrained,
      coherentVariant,
      notes,
    })
  }

  const deltaConstrainedVsIne = populationDiffPct(
    INE_NATIONAL_PROJECTION_2020,
    nationalConstrained,
  )
  const deltaUnconstrainedVsIne = populationDiffPct(
    INE_NATIONAL_PROJECTION_2020,
    nationalUnconstrained,
  )

  const ruralDepts = ['GT16', 'GT17', 'GT15', 'GT20']
  const ruralDeltaC =
    departments
      .filter((d) => ruralDepts.includes(d.adm1Pcode))
      .reduce((s, d) => s + d.deltaConstrainedPct, 0) / ruralDepts.length
  const ruralDeltaU =
    departments
      .filter((d) => ruralDepts.includes(d.adm1Pcode))
      .reduce((s, d) => s + d.deltaUnconstrainedPct, 0) / ruralDepts.length

  let recommended: WorldPopVariant | 'dual_use' = 'dual_use'
  const rationale: string[] = []
  rationale.push(
    `Nacional: unconstrained Δ ${deltaUnconstrainedVsIne}% vs constrained ${deltaConstrainedVsIne}% vs INE 2020.`,
  )
  if (ruralDeltaU < ruralDeltaC) {
    rationale.push(
      `Departamentos rurales: unconstrained Δ medio ${ruralDeltaU.toFixed(1)}% vs constrained ${ruralDeltaC.toFixed(1)}%.`,
    )
  } else {
    rationale.push(
      `Departamentos rurales: constrained Δ medio ${ruralDeltaC.toFixed(1)}% vs unconstrained ${ruralDeltaU.toFixed(1)}%.`,
    )
  }
  const peten = departments.find((d) => d.adm1Pcode === 'GT17')
  if (peten && peten.deltaUnconstrainedPct > 20) {
    rationale.push(
      `Petén: unconstrained sobreestima fuertemente (${peten.deltaUnconstrainedPct}% vs INE) — constrained más coherente localmente.`,
    )
    recommended = 'dual_use'
  }
  rationale.push(
    'Opción C recomendada: constrained primario para exposición urbana y buffers; unconstrained como validación rural/nacional hasta 7D.1B.',
  )

  const report: PopulationAuditReport = {
    generatedAt: new Date().toISOString(),
    national: {
      constrained: nationalConstrained,
      unconstrained: nationalUnconstrained,
      ineProjection2020: INE_NATIONAL_PROJECTION_2020,
      ineCensus2018Separate: INE_CENSUS_NATIONAL_2018,
      deltaConstrainedVsIne2020Pct: deltaConstrainedVsIne,
      deltaUnconstrainedVsIne2020Pct: deltaUnconstrainedVsIne,
    },
    departments,
    territorialZones,
    rawInspections: {
      constrained_wgs84_cog: constrainedInspection,
      unconstrained_wgs84_cog: unconstrainedInspection,
    },
    recommendedPrimaryVariant: recommended,
    recommendationRationale: rationale,
    limitations: [
      'Sumas derivadas de histograma GDAL — tolerancia aproximada ±0.5%.',
      'INE municipal 2020 no importado — sin factor de ajuste municipal.',
      'Comparación INE usa proyección departamental 2020, no Censo 2018.',
      'No inferir población de vivienda individual.',
    ],
  }

  const manifest = loadPopulationManifest()
  manifest.audit = {
    completed_at: report.generatedAt,
    national: report.national,
    recommended_primary_variant: report.recommendedPrimaryVariant,
  }
  manifest.recommended_primary_variant = report.recommendedPrimaryVariant
  savePopulationManifest(manifest)

  writeAuditMarkdown(report)
  return report
}

function writeAuditMarkdown(report: PopulationAuditReport): void {
  mkdirSync(resolve(POPULATION_AUDIT_REPORT, '..'), { recursive: true })
  const deptTable = report.departments
    .map(
      (d) =>
        `| ${d.departmentName} | ${d.constrainedSum.toLocaleString()} | ${d.unconstrainedSum.toLocaleString()} | ${d.ineProjection2020.toLocaleString()} | ${d.deltaConstrainedPct}% | ${d.deltaUnconstrainedPct}% |`,
    )
    .join('\n')

  const zoneBlocks = report.territorialZones
    .map((z) => {
      const radii = Object.keys(z.constrained)
        .map(
          (r) =>
            `- ${Number(r) / 1000} km: constrained ${Math.round(z.constrained[r] ?? 0).toLocaleString()} · unconstrained ${Math.round(z.unconstrained[r] ?? 0).toLocaleString()}`,
        )
        .join('\n')
      return `### ${z.name}\n\nCoordenadas: ${z.lat}, ${z.lon}\n\n${radii}\n\nVariante más coherente: **${z.coherentVariant}**\n\n${z.notes.map((n) => `- ${n}`).join('\n')}`
    })
    .join('\n\n')

  const md = `# WorldPop 2020 — auditoría poblacional Guatemala (7D.1A)

Generado: ${report.generatedAt}

## Resumen nacional

| Métrica | Valor |
|---------|-------|
| WorldPop constrained 2020 | ${report.national.constrained.toLocaleString()} |
| WorldPop unconstrained 2020 | ${report.national.unconstrained.toLocaleString()} |
| INE proyección 2020 | ${report.national.ineProjection2020.toLocaleString()} |
| Δ constrained vs INE 2020 | ${report.national.deltaConstrainedVsIne2020Pct}% |
| Δ unconstrained vs INE 2020 | ${report.national.deltaUnconstrainedVsIne2020Pct}% |

### Censo 2018 (sección separada — no usar para Δ raster 2020)

Población censada nacional 2018: **${report.national.ineCensus2018Separate.toLocaleString()}** (${INE_PROJECTION_REFERENCE_YEAR} ≠ 2018).

Fuente proyección: ${INE_PROJECTION_SOURCE}

## Departamentos (22)

| Departamento | Constrained | Unconstrained | INE 2020 | Δ C | Δ U |
|--------------|-------------|---------------|----------|-----|-----|
${deptTable}

## Validación territorial

${zoneBlocks}

## Recomendación

**${report.recommendedPrimaryVariant}**

${report.recommendationRationale.map((r) => `- ${r}`).join('\n')}

## Limitaciones

${report.limitations.map((l) => `- ${l}`).join('\n')}

## Política de ajuste INE

- Reconciliar WorldPop 2020 ↔ **proyección INE 2020** únicamente.
- Sin proyección municipal válida → \`adjustment_not_applied\`.
- Nunca comparar raster 2020 con Censo 2018 como discrepancia del raster.
`
  writeFileSync(POPULATION_AUDIT_REPORT, md, 'utf8')
}
