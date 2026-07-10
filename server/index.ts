import { config } from 'dotenv'
import { resolve } from 'node:path'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { getSituationReport, isPipelineRunning, runPipeline } from '@/pipeline/orchestrator'
import { startFireScheduler } from '@/pipeline/scheduler/fire.scheduler'
import { verifyMapKey } from '@/pipeline/connectors/firms.connector'
import { handlePreflight } from './http/cors.js'
import { jsonResponse } from './http/json.js'
import { handleFireRoutes } from './routes/fires.js'
import { handleClimateRoutes } from './routes/climate.js'
import { handleBiodiversityRoutes } from './routes/biodiversity.js'
import { handleFindingsRoutes, handleFireFindingsRoute } from './routes/findings.js'
import { handlePrioritiesRoutes, handleFirePriorityRoute } from './routes/priorities.js'
import { handleLifecycleRoutes } from './routes/lifecycle.js'
import { handleIncidentsRoutes, handleFireEventIncidentRoute } from './routes/incidents.js'
import { handleVerificationRoutes } from './routes/verification.js'
import { handleMissionsRoutes } from './routes/missions.js'

config({ path: resolve(process.cwd(), '.env') })

const PORT = Number(process.env.TERRAMIND_PORT ?? 3001)

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (handlePreflight(req, res)) return

  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const pathname = url.pathname

  if (await handleFireRoutes(req, res, pathname, url.searchParams)) return
  if (await handleClimateRoutes(req, res, pathname, url.searchParams)) return
  if (await handleBiodiversityRoutes(req, res, pathname, url.searchParams)) return
  if (await handleFindingsRoutes(req, res, pathname, url.searchParams)) return
  if (await handleFireFindingsRoute(req, res, pathname)) return
  if (await handlePrioritiesRoutes(req, res, pathname, url.searchParams)) return
  if (await handleFirePriorityRoute(req, res, pathname)) return
  if (await handleLifecycleRoutes(req, res, pathname)) return
  if (await handleIncidentsRoutes(req, res, pathname, url.searchParams)) return
  if (await handleFireEventIncidentRoute(req, res, pathname)) return
  if (await handleVerificationRoutes(req, res, pathname, url.searchParams)) return
  if (await handleMissionsRoutes(req, res, pathname, url.searchParams)) return

  if (pathname === '/api/health' && req.method === 'GET') {
    jsonResponse(req, res, { status: 'ok', service: 'terramind-pipeline' })
    return
  }

  if (pathname === '/api/situacion/brief' && req.method === 'GET') {
    jsonResponse(req, res, getSituationReport())
    return
  }

  if (pathname === '/api/pipeline/status' && req.method === 'GET') {
    const report = getSituationReport()
    jsonResponse(req, res, {
      running: isPipelineRunning(),
      lastSyncAt: report.lastSyncAt,
      nextSyncAt: report.nextSyncAt,
      systemStatus: report.systemStatus,
    })
    return
  }

  if (pathname === '/api/firms/status' && req.method === 'GET') {
    const configured = Boolean(process.env.NASA_FIRMS_MAP_KEY?.trim())
    if (!configured) {
      jsonResponse(req, res, { configured: false, valid: false })
      return
    }
    const status = await verifyMapKey()
    jsonResponse(req, res, { configured: true, ...status })
    return
  }

  if (pathname === '/api/pipeline/sync' && req.method === 'POST') {
    const result = await runPipeline()
    jsonResponse(req, res, result)
    return
  }

  jsonResponse(req, res, { error: 'Not found' }, 404)
})

server.listen(PORT, () => {
  console.log(`[TerraMind] API escuchando en http://localhost:${PORT}`)
  startFireScheduler()
})
