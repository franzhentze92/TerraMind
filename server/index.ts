import { config } from 'dotenv'
import { resolve } from 'node:path'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { getSituationReport, isPipelineRunning, runPipeline } from '@/pipeline/orchestrator'
import { startScheduler } from '@/pipeline/scheduler'
import { verifyMapKey } from '@/pipeline/connectors/firms.connector'

config({ path: resolve(process.cwd(), '.env') })

const PORT = Number(process.env.TERRAMIND_PORT ?? 3001)

function jsonResponse(res: ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(data))
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? '/'

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  if (url === '/api/health' && req.method === 'GET') {
    jsonResponse(res, { status: 'ok', service: 'terramind-pipeline' })
    return
  }

  if (url === '/api/situacion/brief' && req.method === 'GET') {
    jsonResponse(res, getSituationReport())
    return
  }

  if (url === '/api/pipeline/status' && req.method === 'GET') {
    const report = getSituationReport()
    jsonResponse(res, {
      running: isPipelineRunning(),
      lastSyncAt: report.lastSyncAt,
      nextSyncAt: report.nextSyncAt,
      systemStatus: report.systemStatus,
    })
    return
  }

  if (url === '/api/firms/status' && req.method === 'GET') {
    const configured = Boolean(process.env.NASA_FIRMS_MAP_KEY?.trim())
    if (!configured) {
      jsonResponse(res, { configured: false, valid: false })
      return
    }
    const status = await verifyMapKey()
    jsonResponse(res, { configured: true, ...status })
    return
  }

  if (url === '/api/pipeline/sync' && req.method === 'POST') {
    const result = await runPipeline()
    jsonResponse(res, result)
    return
  }

  jsonResponse(res, { error: 'Not found' }, 404)
})

server.listen(PORT, () => {
  console.log(`[TerraMind] API escuchando en http://localhost:${PORT}`)
  startScheduler()
})
