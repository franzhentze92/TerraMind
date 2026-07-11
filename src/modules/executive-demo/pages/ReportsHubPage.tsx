import { Link } from 'react-router-dom'
import { ModuleHeader, OperationalEmptyState } from '@/shared/components'
import { FileText, Globe, AlertTriangle } from 'lucide-react'
import { useCanonicalOperationalCounts } from '@/shared/hooks/useCanonicalOperationalCounts'

const REPORT_TYPES = [
  {
    id: 'national',
    label: 'Informe nacional',
    description: 'Resumen ejecutivo, métricas, mapa, hallazgos, incidentes y metodología.',
  },
  {
    id: 'incident',
    label: 'Informe por incidente',
    description: 'Historia completa del ciclo operacional y línea de tiempo institucional.',
  },
  {
    id: 'verification',
    label: 'Verificación y misiones',
    description: 'Documentado dentro del informe por incidente cuando existen etapas registradas.',
  },
] as const

const REPORT_FORMATS = [
  { id: 'html', label: 'HTML en pantalla', description: 'Lectura interactiva dentro de la plataforma.' },
  { id: 'pdf', label: 'PDF descargable', description: 'Documento con portada, numeración y clasificación.' },
  { id: 'print', label: 'Impresión A4', description: 'Estilos institucionales para imprimir en papel A4.' },
] as const

export function ReportsHubPage() {
  const counts = useCanonicalOperationalCounts()
  const hasOperationalIncidents = counts.incidentsOperational > 0

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6" data-testid="reports-hub-page">
      <ModuleHeader
        title="Centro de informes"
        description="Informes institucionales generados bajo demanda"
      />

      <section className="mt-2" aria-labelledby="reports-generate">
        <h2 id="reports-generate" className="text-sm font-semibold text-text-primary">
          Generar nuevo informe
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <GenerateCard
            icon={<Globe className="h-6 w-6 text-accent" />}
            title="Informe nacional"
            description="Resumen ejecutivo · métricas · mapa · hallazgos · incidentes · metodología"
            href="/informes/nacional"
          />
          {hasOperationalIncidents ? (
            <GenerateCard
              icon={<AlertTriangle className="h-6 w-6 text-amber-400" />}
              title="Informe por incidente"
              description="Historia completa del ciclo operacional · línea de tiempo institucional"
              href="/incidentes"
            />
          ) : (
            <div className="flex flex-col rounded-xl border border-dashed border-border-subtle bg-surface-2/20 p-5 opacity-80">
              <AlertTriangle className="h-6 w-6 text-text-tertiary" />
              <h3 className="mt-3 font-medium text-text-primary">Informe por incidente</h3>
              <p className="mt-1 text-sm text-text-secondary">
                Disponible cuando existan incidentes operacionales de la organización en el periodo.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="reports-recent">
        <h2 id="reports-recent" className="text-sm font-semibold text-text-primary">
          Informes recientes
        </h2>
        <OperationalEmptyState
          compact
          className="mt-3"
          title="No hay informes guardados"
          explanation="Los informes se generan bajo demanda y no se archivan automáticamente. Genera uno desde la sección superior."
          primaryAction={{ label: 'Generar informe nacional', href: '/informes/nacional' }}
          status="empty"
        />
      </section>

      <section className="mt-8" aria-labelledby="reports-types">
        <h2 id="reports-types" className="text-sm font-semibold text-text-primary">
          Tipos de informe
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {REPORT_TYPES.map((t) => (
            <div key={t.id} className="rounded-xl border border-border-subtle bg-surface-2/40 p-4">
              <FileText className="h-5 w-5 text-text-secondary" />
              <h3 className="mt-2 text-sm font-medium text-text-primary">{t.label}</h3>
              <p className="mt-1 text-xs text-text-secondary">{t.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8" aria-labelledby="reports-formats">
        <h2 id="reports-formats" className="text-sm font-semibold text-text-primary">
          Formatos disponibles
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {REPORT_FORMATS.map((f) => (
            <div key={f.id} className="rounded-xl border border-border-subtle bg-surface-2/40 p-4">
              <h3 className="text-sm font-medium text-text-primary">{f.label}</h3>
              <p className="mt-1 text-xs text-text-secondary">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-text-tertiary">
        La clasificación aparece en portada, encabezado y pie. Los informes con datos de demostración
        nunca se marcan como oficiales; los registros históricos aparecen en anexos separados.
      </p>
    </div>
  )
}

function GenerateCard({
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
      <p className="mt-1 flex-1 text-sm text-text-secondary">{description}</p>
      <p className="mt-3 text-[10px] uppercase tracking-wide text-accent">Generar →</p>
    </Link>
  )
}
