import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { ConapSigapAttributes } from '@/pipeline/geo/conap-sigap'
import { CONAP_SIGAP_SOURCE_DIR } from '@/pipeline/geo/conap-sigap'
import { territorialNamesEqual } from '@/modules/fires/utils/territorial-display'

export interface ExactDuplicateRecord {
  source_row: number
  source_feature_id: string
  logical_area_key: string
  geometry_hash: string
  attributes: ConapSigapAttributes
  matches_prior_row: boolean
  material_difference: string | null
}

export interface DuplicateAuditReport {
  source_records: number
  unique_features: number
  exact_duplicates_discarded: number
  real_errors: number
  duplicates: ExactDuplicateRecord[]
}

export function attributesEqual(a: ConapSigapAttributes, b: ConapSigapAttributes): boolean {
  return (
    a.codigo_g_1 === b.codigo_g_1 &&
    a.codigo_e_2 === b.codigo_e_2 &&
    territorialNamesEqual(
      {
        general_name: a.NOMBRE_G_1,
        specific_name: a.NOMBRE_e_1,
        general_category: a.Categor_13,
        specific_category: a.Categor_14,
        general_code: a.codigo_g_1,
        specific_code: a.codigo_e_2,
      },
      {
        general_name: b.NOMBRE_G_1,
        specific_name: b.NOMBRE_e_1,
        general_category: b.Categor_13,
        specific_category: b.Categor_14,
        general_code: b.codigo_g_1,
        specific_code: b.codigo_e_2,
      },
    )
  )
}

export function writeDuplicateAuditReport(report: DuplicateAuditReport): string {
  const path = resolve(CONAP_SIGAP_SOURCE_DIR, 'DUPLICATE-AUDIT.md')
  const body = `# Auditoría de duplicados — CONAP SIGAP 2025

| Métrica | Valor |
|---------|-------|
| Registros fuente | ${report.source_records} |
| Features geográficas únicas | ${report.unique_features} |
| Duplicados exactos descartados | ${report.exact_duplicates_discarded} |
| Errores reales de importación | ${report.real_errors} |

## Criterio de descarte

Un registro se descarta como **duplicado exacto** cuando comparte:

- \`logical_area_key\`
- hash de geometría normalizada (EPSG:4326)
- códigos general y específico
- nombres y categorías general/específica

No se añade sufijo artificial para inflar el conteo.

## Registros descartados

${report.duplicates.length === 0 ? '_Ninguno._' : report.duplicates.map((d) => `### Fila fuente ${d.source_row}

- source_feature_id: \`${d.source_feature_id}\`
- logical_area_key: \`${d.logical_area_key}\`
- geometry_hash: \`${d.geometry_hash.slice(0, 16)}…\`
- coincide con registro previo: ${d.matches_prior_row ? 'sí' : 'no'}
- diferencia material: ${d.material_difference ?? 'ninguna'}
`).join('\n')}
`

  writeFileSync(path, body, 'utf8')
  return path
}
