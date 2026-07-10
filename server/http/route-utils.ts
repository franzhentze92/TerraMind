import type { IncomingMessage, ServerResponse } from 'node:http'

import { jsonError } from './json.js'

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function rejectInvalidUuid(
  req: IncomingMessage,
  res: ServerResponse,
  id: string,
  label = 'ID',
): boolean {
  if (UUID_RE.test(id)) return false
  jsonError(req, res, `${label} inválido`, 400)
  return true
}
