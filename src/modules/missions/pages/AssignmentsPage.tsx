import { PageHeader } from '@/shared/components'
import { MissionsAssignmentsPanel } from '../components/MissionsAssignmentsPanel'

/** Legacy alias target — assignments live under Misiones (Phase 2 §4). */
export function AssignmentsPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <PageHeader
        title="Asignaciones"
        subtitle="Misiones por estado de asignación y carga operativa."
        breadcrumbs={[
          { label: 'Misiones', to: '/misiones' },
          { label: 'Asignaciones' },
        ]}
      />
      <div className="mt-4">
        <MissionsAssignmentsPanel />
      </div>
    </div>
  )
}
