import type { IncomingMessage, ServerResponse } from 'node:http'
import { jsonError } from '../http/json.js'

/**
 * TerraMind aún no tiene autenticación de usuarios.
 *
 * Las rutas `/api/environment/fires/*` son server-side y leen Supabase con
 * service role. El frontend solo consume JSON sanitizado vía el proxy de Vite.
 *
 * Cuando exista auth, reemplazar este stub por verificación de sesión/JWT.
 */
export function requireAuth(
  _req: IncomingMessage,
  _res: ServerResponse,
): boolean {
  return true
}

export function rejectIfUnauthenticated(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  if (requireAuth(req, res)) return false
  jsonError(req, res, 'Unauthorized', 401)
  return true
}
