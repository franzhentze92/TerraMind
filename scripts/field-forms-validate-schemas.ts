import { validateAllFireSchemas } from '@/modules/field-operations/field-forms/engine/field-form-validator'

const results = validateAllFireSchemas()
const failed = results.filter((r) => !r.ok)
if (failed.length > 0) {
  console.error(JSON.stringify(failed, null, 2))
  process.exit(1)
}
console.log(JSON.stringify({ ok: true, schemas: results.length }, null, 2))
