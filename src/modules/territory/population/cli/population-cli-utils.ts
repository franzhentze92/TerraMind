export function parseCliArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!
    if (!token.startsWith('--')) continue
    const body = token.slice(2)
    const eq = body.indexOf('=')
    if (eq !== -1) {
      args[body.slice(0, eq)] = body.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      args[body] = next
      i += 1
    } else {
      args[body] = 'true'
    }
  }
  return args
}

export function parseRadiiArg(value: string | undefined): number[] {
  if (!value) return [500, 1000, 3000, 5000]
  return value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
}

export function requireNumberArg(
  args: Record<string, string>,
  key: string,
  aliases: string[] = [],
): number {
  const raw = args[key] ?? aliases.map((a) => args[a]).find(Boolean)
  if (raw == null) {
    throw new Error(`Falta argumento --${key}=<valor>`)
  }
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    throw new Error(`Argumento --${key} inválido: ${raw}`)
  }
  return n
}

export function sanitizeJsonForCli<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => {
      if (typeof v === 'string' && (v.includes(':\\') || v.includes('data/population'))) {
        return '[redacted]'
      }
      if (v && typeof v === 'object' && 'technicalDetails' in (v as object)) {
        const { technicalDetails: _t, ...rest } = v as Record<string, unknown>
        return rest
      }
      return v
    }),
  ) as T
}
