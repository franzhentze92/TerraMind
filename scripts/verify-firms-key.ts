/**
 * Verifica NASA FIRMS MAP_KEY y ejecuta una consulta de prueba para Guatemala.
 * Uso: npm run firms:verify
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { verifyMapKey, fetchFirmsDetections } from '@/pipeline/connectors/firms.connector'

config({ path: resolve(process.cwd(), '.env') })

async function main() {
  const key = process.env.NASA_FIRMS_MAP_KEY?.trim()

  if (!key) {
    console.error('❌ NASA_FIRMS_MAP_KEY no está configurada.')
    console.error('   1. Solicite su clave en https://firms.modaps.eosdis.nasa.gov/api/map_key/')
    console.error('   2. Cree .env desde .env.example')
    console.error('   3. Pegue la clave en NASA_FIRMS_MAP_KEY=')
    process.exit(1)
  }

  console.log('🔑 Verificando MAP_KEY…')
  const status = await verifyMapKey(key)

  if (!status.valid) {
    console.error('❌ MAP_KEY inválida o no reconocida por NASA FIRMS.')
    process.exit(1)
  }

  console.log('✅ MAP_KEY válida')
  console.log(`   Límite: ${status.transactionLimit ?? '?'} transacciones / ${status.transactionInterval ?? '10 minutes'}`)
  console.log(`   Consumo actual: ${status.currentTransactions ?? '?'}`)

  console.log('\n🌎 Consultando Guatemala (3 satélites VIIRS, ventana 2 días)…')
  const result = await fetchFirmsDetections()

  console.log(`✅ ${result.rows.length} foco(s) de calor detectados (únicos)`)
  console.log(`   Latencia: ${result.latencyMs}ms`)
  console.log(`   Filas válidas: ${result.parseStats.validRows}`)
  for (const s of result.sourceSummaries) {
    console.log(`   · ${s.source}: ${s.rows} detecciones`)
  }
  if (result.parseStats.skippedRows > 0) {
    console.log(`   Filas omitidas: ${result.parseStats.skippedRows}`)
  }

  if (result.rows.length > 0) {
    const sample = result.rows[0]
    console.log('\n📍 Muestra (primera detección):')
    console.log(`   Coordenadas: ${sample.latitude}, ${sample.longitude}`)
    console.log(`   FRP: ${sample.frp ?? 'N/A'} MW`)
    console.log(`   Satélite: ${sample.satellite}`)
    console.log(`   UTC: ${sample.acqDate} ${sample.acqTime}`)
  }
}

main().catch((err) => {
  console.error('❌ Error:', err instanceof Error ? err.message : err)
  process.exit(1)
})
