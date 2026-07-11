import { Link } from 'react-router-dom'
import { ModuleHeader, OperationalEmptyState } from '@/shared/components'
import { FileText, Globe, AlertTriangle, Printer } from 'lucide-react'
import { useCanonicalOperationalCounts } from '@/shared/hooks/useCanonicalOperationalCounts'
import { CLASSIFICATION_LABELS } from '@/modules/institutional-reports/report-classification'

const REPORT_TYPES = [
  { id: 'national', label: 'Nacional' },
  { id: 'incident', label: 'Por incidente' },
] as const

export function ReportsHubPage() {
  const counts = useCanonicalOperationalCounts()
  const hasOperationalIncidents = counts.incidentsOperational > 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="reports-hub-page">
      <ModuleHeader
        title="Centro de informes"
        description="Informes institucionales generados bajo demanda · HTML, impresión y PDF unificados"
      />

      <OperationalEmptyState
        compact
        className="mb-6"
        title="No hay informes guardados"
        explanation="Los informes se generan bajo demanda. Elija un tipo, periodo y clasificación al crear uno nuevo."
        primaryAction={{ label: 'Generar informe nacional', href: '/informes/nacional' }}
        secondaryAction={{ label: 'Ver incidentes', href: '/incidentes' }}
        status="empty"
      />

      <div className="mb-6 flex flex-wrap gap-3 print:hidden">
        <fieldset className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-tertiary">Tipo:</span>
          {REPORT_TYPES.map((t) => (
            <span key={t.id} className="rounded border border-border-subtle px-2 py-0.5">
              {t.label}
            </span>
          ))}
        </fieldset>
        <fieldset className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-text-tertiary">Clasificación:</span>
          {Object.values(CLASSIFICATION_LABELS).map((label) => (
            <span key={label} className="rounded border border-border-subtle px-2 py-0.5">
              {label}
            </span>
          ))}
        </fieldset>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <ReportCard
          icon={<Globe className="h-6 w-6 text-accent" />}
          title="Informe nacional"
          description="Resumen ejecutivo · métricas · mapa · hallazgos · incidentes · metodología"
          href="/informes/nacional"
          actions={['Ver', 'Descargar PDF', 'Imprimir']}
        />
        {hasOperationalIncidents ? (
          <ReportCard
            icon={<AlertTriangle className="h-6 w-6 text-amber-400" />}
            title="Informe por incidente"
            description="Historia completa del ciclo operacional · timeline institucional"
            href="/incidentes"
            actions={['Ver', 'Descargar PDF', 'Imprimir']}
          />
        ) : (
          <div className="flex flex-col rounded-xl border border-dashed border-border-subtle bg-surface-2/20 p-5 opacity-80">
            <AlertTriangle className="h-6 w-6 text-text-tertiary" />
            <h3 className="mt-3 font-medium text-text-primary">Informe por incidente</h3>
            <p className="mt-1 text-sm text-text-secondary">
              No se registraron incidentes operacionales pertenecientes a la organización durante el
              periodo actual.
            </p>
          </div>
        )}
        <ReportCard
          icon={<Printer className="h-6 w-6 text-text-secondary" />}
          title="Impresión A4"
          description="Estilos institucionales · portada · numeración · clasificación en cada página"
          href="/informes/nacional"
          actions={['Imprimir']}
        />
        <ReportCard
          icon={<FileText className="h-6 w-6 text-text-secondary" />}
          title="Verificación y misiones"
          description="Documentado en informe por incidente cuando existan etapas registradas"
          href="/verificaciones"
        />
      </div>

      <p className="mt-8 text-xs text-text-tertiary">
        Clasificación visible en portada, encabezado y pie. Los informes con datos de demostración
        nunca se marcan como oficiales. Legacy aparece en anexos separados.
      </p>
    </div>
  )
}

function ReportCard({
  icon,
  title,
  description,
  href,
  actions,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  actions?: string[]
}) {
  return (
    <Link
      to={href}
      className="flex flex-col rounded-xl border border-border-subtle bg-surface-2/40 p-5 hover:border-accent/30"
    >
      {icon}
      <h3 className="mt-3 font-medium text-text-primary">{title}</h3>
      <p className="mt-1 flex-1 text-sm text-text-secondary">{description}</p>
      {actions && actions.length > 0 && (
        <p className="mt-3 text-[10px] uppercase tracking-wide text-text-tertiary">
          {actions.join(' · ')}
        </p>
      )}
    </Link>
  )
}
