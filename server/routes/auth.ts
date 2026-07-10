import type { IncomingMessage, ServerResponse } from 'node:http'

import { handleAuthSessionRoutes, handleProvisioningRoutes } from './provisioning.js'

export async function handleAuthRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (await handleAuthSessionRoutes(req, res, pathname)) return true
  if (await handleProvisioningRoutes(req, res, pathname)) return true
  return false
}
