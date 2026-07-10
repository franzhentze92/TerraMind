import { spawn } from 'node:child_process'

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
  duration_ms: number
}

export async function runCommand(
  executable: string,
  args: string[],
): Promise<CommandResult> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 1,
        duration_ms: Date.now() - started,
      })
    })
  })
}

export async function gdalInfoJson(path: string): Promise<Record<string, unknown>> {
  const res = await runCommand('gdalinfo', ['-json', '-hist', path])
  if (res.exitCode !== 0) {
    throw new Error(`gdalinfo falló (${path}): ${res.stderr || res.stdout}`)
  }
  return JSON.parse(res.stdout) as Record<string, unknown>
}

/** Metadatos sin histograma — para dimensiones, CRS y nodata. */
export async function gdalInfoJsonNoHist(path: string): Promise<Record<string, unknown>> {
  const res = await runCommand('gdalinfo', ['-json', path])
  if (res.exitCode !== 0) {
    throw new Error(`gdalinfo falló (${path}): ${res.stderr || res.stdout}`)
  }
  return JSON.parse(res.stdout) as Record<string, unknown>
}

export async function getToolVersions(): Promise<Record<string, string>> {
  const [gdal, aws, node] = await Promise.all([
    runCommand('gdalinfo', ['--version']),
    runCommand('aws', ['--version']),
    Promise.resolve({ stdout: process.version, stderr: '', exitCode: 0, duration_ms: 0 }),
  ])
  return {
    gdal: gdal.stdout.trim() || gdal.stderr.trim(),
    aws: aws.stdout.trim() || aws.stderr.trim(),
    node: node.stdout.trim(),
  }
}
