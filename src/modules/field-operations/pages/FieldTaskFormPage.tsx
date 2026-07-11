import { Link, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { FieldTaskFormView } from '@/modules/field-operations/field-forms/components/FieldTaskFormView'
import { parsePackageTasks } from '@/modules/field-operations/field-forms/engine/package-compatibility'
import { OfflinePackageRepository } from '@/modules/field-operations/offline-packages/offline-package.repository'

export function FieldTaskFormPage() {
  const { packageId, taskId } = useParams()
  const [pkg, setPkg] = useState<Awaited<ReturnType<OfflinePackageRepository['read']>>>(null)
  const [task, setTask] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (!packageId) return
    void (async () => {
      const record = await OfflinePackageRepository.createDefault().read(packageId)
      setPkg(record)
      if (!record) return
      const tasks = parsePackageTasks(record)
      setTask(tasks.find((t) => String(t.id) === taskId) ?? null)
    })()
  }, [packageId, taskId])

  if (!pkg || !task) {
    return (
      <div className="p-6">
        <Link to={`/campo/paquetes/${packageId}`} className="text-sm text-accent hover:underline">
          ← Volver al paquete
        </Link>
        <p className="mt-4 text-sm text-text-tertiary">Tarea no encontrada.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="border-b border-border-subtle px-4 py-2">
        <Link to={`/campo/paquetes/${packageId}`} className="text-xs text-accent hover:underline">
          ← Paquete
        </Link>
      </div>
      <FieldTaskFormView pkg={pkg} task={task} />
    </div>
  )
}
