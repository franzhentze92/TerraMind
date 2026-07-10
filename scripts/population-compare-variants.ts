#!/usr/bin/env tsx
import {
  parseCliArgs,
  requireNumberArg,
  sanitizeJsonForCli,
} from '@/modules/territory/population/cli/population-cli-utils'
import { createPopulationService } from '@/modules/territory/population/population.service'

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

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  const lat = requireNumberArg(args, 'lat', ['latitude'])
  const lon = requireNumberArg(args, 'lon', ['longitude'])
  const radius = Number(args.radius ?? 1000)
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error('--radius debe ser un número positivo')
  }

  const service = createPopulationService()
  const result = await service.compareVariants({
    geometry: bufferBboxPolygon(lat, lon, radius),
    geometryCrs: 'EPSG:4326',
  })
  console.log(JSON.stringify(sanitizeJsonForCli(result), null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
