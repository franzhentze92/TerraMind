/**
 * Normalización de códigos administrativos TerraMind ↔ INE ↔ HDX COD-AB.
 */

export function adm1PcodeToDepartmentCode(adm1Pcode: string): string {
  const match = /^GT(\d{2})$/i.exec(adm1Pcode.trim())
  if (!match?.[1]) {
    throw new Error(`Código departamento inválido: ${adm1Pcode}`)
  }
  return match[1]
}

export function departmentCodeToAdm1Pcode(code: string): string {
  const normalized = code.padStart(2, '0')
  if (!/^\d{2}$/.test(normalized)) {
    throw new Error(`Código departamento inválido: ${code}`)
  }
  return `GT${normalized}`
}

export function adm2PcodeToMunicipalityCode(adm2Pcode: string): string {
  const match = /^GT(\d{4})$/i.exec(adm2Pcode.trim())
  if (!match?.[1]) {
    throw new Error(`Código municipio inválido: ${adm2Pcode}`)
  }
  return match[1]
}

export function municipalityCodeToAdm2Pcode(code: string): string {
  const normalized = code.padStart(4, '0')
  if (!/^\d{4}$/.test(normalized)) {
    throw new Error(`Código municipio inválido: ${code}`)
  }
  return `GT${normalized}`
}

export function normalizeAdminName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function inferDepartmentFromMunicipalityCode(municipalityCode: string): string {
  return municipalityCode.padStart(4, '0').slice(0, 2)
}
