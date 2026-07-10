import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { ModuleHeader } from '@/shared/components'
import { Badge } from '@/shared/components/Badge'
import { assessPackageFormAccess, parsePackageTasks } from '@/modules/field-operations/field-forms/engine/package-compatibility'
import { FieldFormRepository } from '@/modules/field-operations/field-forms/field-form.repository'
import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'
import { formatGuatemalaDateTime } from '@/modules/fires/utils/format'

const formRepo = FieldFormRepository.createDefault()

function progressLabel(status: string): string {
  const map: Record<string, string> = {
    not_started: 'No iniciada',
    draft: 'Borrador',
    complete: 'Completa',
    complete_with_limitations: 'Completa con limitaciones',
    blocked: 'Bloqueada',
  }
  return map[status] ?? status
}

export function FieldPackageDetailPage() {
  const { packageId } = useParams()
  const [pkg, setPkg] = useState<Awaited<ReturnType<OfflinePackageRepository['read']>>>(null)
  const [progress, setProgress] = useState<Array<{ task_id: string; status: string }>>([])
  const now = new Date().toISOString()

  useEffect(() => {
    if (!packageId) return
    void (async () => {
      const record = await OfflinePackageRepository.createDefault().read(packageId)
      setPkg(record)
      if (!record) return
      const tasks = parsePackageTasks(record).map((t) => ({
        id: String(t.id),
        task_type: String(t.task_type),
        schema_id: t.form_schema_id ? String(t.form_schema_id) : null,
      }))
      const prog = await formRepo.computeTaskProgress(record.package_id, tasks)
      setProgress(prog)
    })()
  }, [packageId])

  if (!pkg) {
    return <p className="p-6 text-sm text-text-tertiary">Paquete no encontrado localmente.</p>
  }

  const access = assessPackageFormAccess(pkg, now, { allowHistorical: true })
  const tasks = parsePackageTasks(pkg)

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4 md:p-6">
      <ModuleHeader title={pkg.mission_title} description={`Paquete v${pkg.package_version} — campo offline`} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge variant="default">{pkg.local_status}</Badge>
        <Badge variant="default">{access.mode}</Badge>
      </div>

      {access.mode === 'blocked' && (
        <p className="mb-4 text-sm text-confidence-low">{access.reasons.join(', ')}</p>
      )}

      <p className="mb-4 text-xs text-text-tertiary">
        Vigencia: {formatGuatemalaDateTime(pkg.manifest.valid_until)}
      </p>

      <section>
        <h2 className="mb-3 text-sm font-medium text-text-primary">Tareas</h2>
        <div className="grid gap-3">
          {tasks.map((task) => {
            const prog = progress.find((p) => p.task_id === String(task.id))
            return (
              <Link
                key={String(task.id)}
                to={`/campo/paquetes/${pkg.package_id}/tareas/${String(task.id)}`}
                className="block rounded-lg border border-border-subtle bg-surface-2/30 p-4 text-sm hover:border-accent/30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-text-primary">{String(task.title)}</span>
                  <Badge variant="default">{progressLabel(prog?.status ?? 'not_started')}</Badge>
                </div>
                <p className="mt-1 text-xs text-text-tertiary">Seq {String(task.sequence)} · {String(task.task_type)}</p>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}
