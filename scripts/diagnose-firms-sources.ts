import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env') })

const key = process.env.NASA_FIRMS_MAP_KEY?.trim()
if (!key) {
  console.error('NASA_FIRMS_MAP_KEY no configurada')
  process.exit(1)
}

const bbox = '-92.5,13.5,-88.0,18.0'
const sources = [
  'VIIRS_SNPP_NRT',
  'VIIRS_NOAA20_NRT',
  'VIIRS_NOAA21_NRT',
  'MODIS_NRT',
]

for (const src of sources) {
  for (const days of [1, 2, 3, 4, 5]) {
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${src}/${bbox}/${days}`
    const r = await fetch(url)
    const text = await r.text()
    const lineCount = text.trim() ? text.trim().split(/\r?\n/).length - 1 : 0
    const preview = text.trim().split(/\r?\n/).slice(0, 2).join(' | ')
    console.log(`${src} days=${days} status=${r.status} rows=${Math.max(0, lineCount)}`)
    if (lineCount > 0 && lineCount <= 3) console.log('  ', preview)
  }
}
