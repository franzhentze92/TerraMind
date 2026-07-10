import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LAND_COVER_TEMP_DIR_PREFIX } from '@/modules/territory/land-cover/processing/paths'

export class RasterTempWorkspace {
  readonly dir: string

  constructor(prefix = LAND_COVER_TEMP_DIR_PREFIX) {
    this.dir = mkdtempSync(join(tmpdir(), prefix))
  }

  path(name: string): string {
    return join(this.dir, name)
  }

  dispose(): void {
    rmSync(this.dir, { recursive: true, force: true })
  }
}

export async function withRasterTempWorkspace<T>(
  fn: (ws: RasterTempWorkspace) => Promise<T>,
): Promise<T> {
  const ws = new RasterTempWorkspace()
  try {
    return await fn(ws)
  } finally {
    ws.dispose()
  }
}
