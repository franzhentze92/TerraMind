import { Link } from 'react-router-dom'
import { ModuleHeader, OperationalEmptyState } from '@/shared/components'
import { FileText, Globe, AlertTriangle } from 'lucide-react'
import { useCanonicalOperationalCounts } from '@/shared/hooks/useCanonicalOperationalCounts'

export function ReportsHubPage() {
  const counts = useCanonicalOperationalCounts()
  const hasOperationalIncidents = counts.incidentsOperational > 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="reports-hub-page">
      <ModuleHeader
        title="Centro de informes"
        description="Informes ejecutivos generados bajo demanda desde datos reales TerraMind"
      />

      <OperationalEmptyState
        compact
        className="mb-6"
        title="No hay informes guardados"
        explanation="Los informes pueden generarse desde Situación Nacional o desde el detalle de un incidente."
        primaryAction={{ label: 'Generar informe nacional', href: '/informes/nacional' }}
        secondaryAction={{ label: 'Ver incidentes', href: '/incidentes' }}
        status="empty"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ReportCard
          icon={<Globe className="h-6 w-6 text-accent" />}
          title="Informe nacional"
          description="Situación ambiental agregada · período configurable"
          href="/informes/nacional"
        />
        {hasOperationalIncidents ? (
          <ReportCard
            icon={<AlertTriangle className="h-6 w-6 text-amber-400" />}
            title="Informe por incidente"
            description="Historia completa del incidente con mayor cobertura de datos"
            href="/incidentes"
          />
        ) : (
          <div className="flex flex-col rounded-xl border border-dashed border-border-subtle bg-surface-2/20 p-5 opacity-80">
            <AlertTriangle className="h-6 w-6 text-text-tertiary" />
            <h3 className="mt-3 font-medium text-text-primary">Informe por incidente</h3>
            <p className="mt-1 text-sm text-text-secondary">
              Disponible cuando exista un incidente operacional con historia completa.
            </p>
          </div>
        )}
        <ReportCard
          icon={<FileText className="h-6 w-6 text-text-secondary" />}
          title="Verificación y misiones"
          description="Disponible desde detalle de incidente e informe individual"
          href="/verificaciones"
        />
        <ReportCard
          icon={<FileText className="h-6 w-6 text-text-secondary" />}
          title="Respuesta operacional"
          description="Evaluaciones y decisiones cuando existan incidentes operacionales"
          href="/respuesta"
        />
      </div>

      <p className="mt-8 text-xs text-text-tertiary">
        Los informes usan clasificación interna. No se marcan como verificados si contienen etapas
        pendientes o datos de demostración.
      </p>
    </div>
  )
}

function ReportCard({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      to={href}
      className="flex flex-col rounded-xl border border-border-subtle bg-surface-2/40 p-5 hover:border-accent/30"
    >
      {icon}
      <h3 className="mt-3 font-medium text-text-primary">{title}</h3>
      <p className="mt-1 text-sm text-text-secondary">{description}</p>
    </Link>
  )
}
