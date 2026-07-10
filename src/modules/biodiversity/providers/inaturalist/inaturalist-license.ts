const LICENSE_MAP: Record<string, string> = {
  cc0: 'CC0-1.0',
  'cc-by': 'CC-BY-4.0',
  'cc-by-nc': 'CC-BY-NC-4.0',
  'cc-by-sa': 'CC-BY-SA-4.0',
  'cc-by-nd': 'CC-BY-ND-4.0',
  'cc-by-nc-sa': 'CC-BY-NC-SA-4.0',
  'cc-by-nc-nd': 'CC-BY-NC-ND-4.0',
}

export function mapInatLicenseCode(code?: string | null): string | undefined {
  if (!code) return undefined
  const normalized = code.toLowerCase().trim()
  return LICENSE_MAP[normalized] ?? code
}
