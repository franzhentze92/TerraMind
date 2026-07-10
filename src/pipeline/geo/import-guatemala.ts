import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getSupabaseAdmin } from '@/pipeline/stores/supabase.client'
import {
  EXPECTED_ADM1_PCODES,
  HDX_COD_AB_FILES,
  HDX_COD_AB_SOURCE_DIR,
  type HdxAdm0Properties,
  type HdxAdm1Properties,
  pcodeToIneCode,
} from '@/pipeline/geo/hdx-cod-ab'

interface GeoJsonFeature<G> {
  type: 'Feature'
  geometry: Record<string, unknown>
  properties: G
}

interface GeoJsonFeatureCollection<G> {
  type: 'FeatureCollection'
  features: GeoJsonFeature<G>[]
}

function loadGeoJson<G>(relativePath: string): GeoJsonFeatureCollection<G> {
  const filePath = resolve(process.cwd(), HDX_COD_AB_SOURCE_DIR, relativePath)
  if (!existsSync(filePath)) {
    throw new Error(`Archivo geográfico no encontrado: ${filePath}`)
  }
  return JSON.parse(readFileSync(filePath, 'utf8')) as GeoJsonFeatureCollection<G>
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

async function compareWithMinfin(adm1: GeoJsonFeatureCollection<HdxAdm1Properties>) {
  const minfinPath = resolve(
    process.cwd(),
    'data/geo/sources/minfin-v1.0.0/deptos.json',
  )
  if (!existsSync(minfinPath)) {
    console.log('  MINFIN: archivo no presente (comparación omitida)')
    return
  }

  try {
    const topo = JSON.parse(readFileSync(minfinPath, 'utf8')) as {
      objects?: Record<
        string,
        { geometries?: Array<{ properties?: { id?: string | number; Departamento?: string } }> }
      >
    }
    const minfinObject =
      topo.objects?.departamentos_gtm ?? topo.objects?.deptos ?? null
    const geoms = minfinObject?.geometries ?? []
    console.log(`  MINFIN: ${geoms.length} departamentos en archivo de comparación`)
    if (geoms.length !== 22) {
      console.warn(`  MINFIN: se esperaban 22, encontrados ${geoms.length}`)
    }

    const hdxNames = new Set(adm1.features.map((f) => normalizeName(f.properties.adm1_name)))
    const minfinNames = new Set(
      geoms.map((g) => normalizeName(g.properties?.Departamento ?? '')),
    )
    const onlyHdx = [...hdxNames].filter((n) => !minfinNames.has(n))
    const onlyMinfin = [...minfinNames].filter((n) => !hdxNames.has(n))
    if (onlyHdx.length || onlyMinfin.length) {
      console.warn('  MINFIN: diferencias de nombres detectadas')
      if (onlyHdx.length) console.warn(`    solo HDX: ${onlyHdx.join(', ')}`)
      if (onlyMinfin.length) console.warn(`    solo MINFIN: ${onlyMinfin.join(', ')}`)
    } else {
      console.log('  MINFIN: nombres de 22 departamentos coinciden (normalizado)')
    }
  } catch {
    console.warn('  MINFIN: no se pudo parsear deptos.json para comparación')
  }
}

export async function importGuatemalaBoundaries(): Promise<void> {
  const supabase = getSupabaseAdmin()
  const adm0 = loadGeoJson<HdxAdm0Properties>(HDX_COD_AB_FILES.adm0)
  const adm1 = loadGeoJson<HdxAdm1Properties>(HDX_COD_AB_FILES.adm1)

  if (adm0.features.length !== 1) {
    throw new Error(`ADM0: se esperaba 1 geometría, encontradas ${adm0.features.length}`)
  }
  if (adm1.features.length !== 22) {
    throw new Error(`ADM1: se esperaban 22 departamentos, encontrados ${adm1.features.length}`)
  }

  const adm0Feature = adm0.features[0]
  const { error: countryError } = await supabase.rpc('geo_upsert_country_boundary', {
    p_code: 'GT',
    p_name: adm0Feature.properties.adm0_name,
    p_source_pcode: adm0Feature.properties.adm0_pcode,
    p_geojson: adm0Feature.geometry,
  })
  if (countryError) {
    throw new Error(`Error importando ADM0: ${countryError.message}`)
  }
  console.log(`✅ País importado: ${adm0Feature.properties.adm0_name} (${adm0Feature.properties.adm0_pcode})`)

  const seenCodes = new Set<string>()
  const seenPcodes = new Set<string>()
  const seenNames = new Set<string>()

  for (const feature of adm1.features) {
    const props = feature.properties
    const pcode = props.adm1_pcode
    const code = pcodeToIneCode(pcode)
    const nameKey = normalizeName(props.adm1_name)

    if (!EXPECTED_ADM1_PCODES.includes(pcode as (typeof EXPECTED_ADM1_PCODES)[number])) {
      throw new Error(`P-code ADM1 inesperado: ${pcode}`)
    }
    if (seenCodes.has(code)) throw new Error(`Código duplicado: ${code}`)
    if (seenPcodes.has(pcode)) throw new Error(`P-code duplicado: ${pcode}`)
    if (seenNames.has(nameKey)) throw new Error(`Nombre duplicado: ${props.adm1_name}`)

    seenCodes.add(code)
    seenPcodes.add(pcode)
    seenNames.add(nameKey)

    const { error } = await supabase.rpc('geo_upsert_department_boundary', {
      p_country_code: 'GT',
      p_code: code,
      p_name: props.adm1_name,
      p_source_pcode: pcode,
      p_geojson: feature.geometry,
    })
    if (error) {
      throw new Error(`Error importando ${pcode} ${props.adm1_name}: ${error.message}`)
    }
    console.log(`  · ${pcode} → ${code} ${props.adm1_name}`)
  }

  console.log('\n📋 Validaciones post-importación…')

  const { data: validation, error: valError } = await supabase.rpc(
    'geo_validate_guatemala_import',
  )
  if (valError) throw new Error(`Validación falló: ${valError.message}`)
  console.log(JSON.stringify(validation, null, 2))

  if (validation.department_count !== 22) {
    throw new Error(`Validación: se esperaban 22 departamentos, hay ${validation.department_count}`)
  }
  if (!validation.country_has_boundary) {
    throw new Error('Validación: Guatemala sin boundary')
  }
  if (validation.invalid_geometries > 0 || validation.empty_geometries > 0) {
    throw new Error('Validación: geometrías inválidas o vacías detectadas')
  }
  if (validation.wrong_srid_count > 0) {
    throw new Error('Validación: SRID distinto de 4326')
  }

  const { data: dupCodes } = await supabase
    .from('geo_departments')
    .select('code')
    .eq('country_code', 'GT')
  const codes = dupCodes?.map((r) => r.code) ?? []
  if (new Set(codes).size !== codes.length) {
    throw new Error('Validación: códigos duplicados en geo_departments')
  }

  const { data: dupNames } = await supabase
    .from('geo_departments')
    .select('name')
    .eq('country_code', 'GT')
  const names = dupNames?.map((r) => r.name) ?? []
  if (new Set(names).size !== names.length) {
    throw new Error('Validación: nombres duplicados en geo_departments')
  }

  console.log('\n🔍 Comparación con MINFIN (secundaria)…')
  await compareWithMinfin(adm1)

  console.log('\n✅ Importación HDX COD-AB completada')
}
