#!/usr/bin/env tsx
/**
 * Validación rápida de proveedores y capa visual (7C.4B).
 * Uso: npx tsx scripts/biodiversity-visual-validate.ts
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { getBiodiversityService } from '../src/modules/biodiversity/biodiversity.service'
import { getBiodiversityVisualService } from '../src/modules/biodiversity/biodiversity-visual.service'
import { getBiodiversityZoneByCode } from '../src/modules/biodiversity/config/biodiversity-zones.config'

config({ path: resolve(process.cwd(), '.env') })

const zone = getBiodiversityZoneByCode('acatenango')!

async function main() {
  const biodiversity = getBiodiversityService()
  const visual = getBiodiversityVisualService()
  const filters = {
    period: '5y' as const,
    source: 'all' as const,
    taxon: 'all' as const,
    quality: 'all' as const,
    zone: 'all' as const,
  }

  console.log('=== Zona Acatenango — búsqueda combinada ===')
  const started = Date.now()
  const search = await biodiversity.searchOccurrences({
    latitude: zone.latitude,
    longitude: zone.longitude,
    radiusM: zone.radiusM,
    observedFrom: '2021-01-01',
    limit: 200,
    preferVisualMedia: true,
  })
  console.log(`Tiempo: ${Date.now() - started}ms`)
  console.log(`Total items: ${search.items.length}`)
  console.log(`GBIF: ${search.items.filter((o) => o.source === 'gbif').length}`)
  console.log(`iNat: ${search.items.filter((o) => o.source === 'inaturalist').length}`)
  console.log(`Con visualMedia: ${search.items.filter((o) => o.visualMedia).length}`)
  console.log(`Errores proveedor:`, search.providerErrors)

  const sample = search.items.find((o) => o.visualMedia)
  if (sample?.visualMedia) {
    console.log('\n=== Muestra con imagen ===')
    console.log({
      source: sample.source,
      id: sample.sourceOccurrenceId,
      taxon: sample.scientificName,
      imageUrl: sample.visualMedia.imageUrl,
      license: sample.visualMedia.imageLicense,
      attribution: sample.attribution,
      url: sample.sourceUrl,
    })
  }

  console.log('\n=== Visual summary (5 zonas) ===')
  const vStarted = Date.now()
  const summary = await visual.getVisualSummary(filters, { skipCache: true })
  console.log(`Tiempo: ${Date.now() - vStarted}ms`)
  console.log(`Status: ${summary.status}`)
  console.log(`Featured: ${summary.featured_species.length}`)
  console.log(`Recent: ${summary.recent_observations.length}`)
  console.log(`Zone highlights: ${summary.zone_highlights.length}`)
  console.log('Diagnostics:', summary.diagnostics)

  if (summary.featured_species[0]) {
    const f = summary.featured_species[0]
    console.log('\n=== Primera especie destacada ===')
    console.log({
      name: f.commonName ?? f.scientificName,
      source: f.source,
      imageUrl: f.imageUrl,
      license: f.imageLicense,
    })
  }
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
